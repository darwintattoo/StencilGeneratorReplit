import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express, Request, Response } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export function setupAuth(app: Express) {
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || 'tattoostencilpro-secret-key',
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    }
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        // Buscar usuario por username o email
        let user = await storage.getUserByUsername(username);
        
        if (!user) {
          // Comprobar si es un email
          if (username.includes('@')) {
            user = await storage.getUserByEmail(username);
          }
        }
        
        if (!user || !(await comparePasswords(password, user.password))) {
          return done(null, false, { message: 'Usuario o contraseña incorrectos' });
        } 
        
        return done(null, user);
      } catch (err) {
        return done(err);
      }
    }),
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (err) {
      done(err);
    }
  });

  app.post("/api/register", async (req, res, next) => {
    try {
      // Lista de correos electrónicos autorizados que pueden registrarse aunque el registro esté desactivado
      // Esto es útil para permitir a ciertos usuarios registrarse durante el periodo de prueba
      const AUTHORIZED_EMAILS = [
        'admin@tattoostencilpro.com',
        'demo@tattoostencilpro.com',
        'darwin@tattoostencilpro.com',
        // Añadir más emails autorizados aquí
      ];
      
      // Comprobar si la solicitud incluye un email autorizado
      const isAuthorizedEmail = AUTHORIZED_EMAILS.includes(req.body.email?.toLowerCase());
      
      // Si no es un email autorizado, rechazar el registro
      if (!isAuthorizedEmail) {
        return res.status(403).json({ 
          message: "El registro de nuevos usuarios está temporalmente desactivado. Por favor, contacte al administrador del sistema.",
          registrationDisabled: true
        });
      }
      
      // Verificar si ya existe un usuario con ese nombre o email
      const existingUsername = await storage.getUserByUsername(req.body.username);
      if (existingUsername) {
        return res.status(400).json({ message: "El nombre de usuario ya está en uso" });
      }
      
      const existingEmail = await storage.getUserByEmail(req.body.email);
      if (existingEmail) {
        return res.status(400).json({ message: "El email ya está registrado" });
      }

      // Crear el usuario (si está autorizado)
      const user = await storage.createUser({
        ...req.body,
        password: await hashPassword(req.body.password),
        // Asignar rol por defecto user, pero si es uno de los emails especiales, asignar admin
        role: req.body.email?.toLowerCase() === 'admin@tattoostencilpro.com' ? 'admin' : 'user'
      });

      // Iniciar sesión automáticamente
      req.login(user, (err) => {
        if (err) return next(err);
        return res.status(201).json({
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role
        });
      });
    } catch (err) {
      return next(err);
    }
  });

  app.post("/api/login", (req, res, next) => {
    passport.authenticate('local', (err: Error | null, user: Express.User | false, info: { message: string } | undefined) => {
      if (err) return next(err);
      if (!user) {
        return res.status(401).json({ message: info?.message || 'Falló la autenticación' });
      }
      req.login(user, (err: Error | null) => {
        if (err) return next(err);
        return res.json({
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role
        });
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'No autenticado' });
    }
    
    const user = req.user as SelectUser;
    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role
    });
  });

  // Middleware para proteger rutas
  const requireAuth = (req: any, res: Response, next: Function) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'No autenticado' });
    }
    next();
  };

  // Exportamos la función para usarla en routes.ts
  return requireAuth;
}
