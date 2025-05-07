import { pool } from '../server/db';
import { storage } from '../server/storage';
import { scrypt, randomBytes } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

/**
 * Script para crear o actualizar usuarios predefinidos en el sistema
 * Usado para crear cuentas admin y demo cuando no está disponible el registro público
 */
async function createPredefinedUsers() {
  try {
    // Definir los usuarios predefinidos
    const users = [
      {
        username: 'admin',
        email: 'admin@tattoostencilpro.com',
        password: 'adminpassword123', // Cambiar a una contraseña fuerte en producción
        role: 'admin'
      },
      {
        username: 'demo',
        email: 'demo@tattoostencilpro.com',
        password: 'demopassword123', // Cambiar a una contraseña fuerte en producción
        role: 'user'
      }
    ];

    // Intentar crear cada usuario
    for (const userData of users) {
      // Verificar si ya existe
      const existingUser = await storage.getUserByUsername(userData.username);
      
      if (existingUser) {
        console.log(`Usuario ${userData.username} ya existe, omitiendo...`);
        continue;
      }
      
      // Hashear la contraseña
      const hashedPassword = await hashPassword(userData.password);
      
      // Crear el usuario
      const newUser = await storage.createUser({
        username: userData.username,
        email: userData.email,
        password: hashedPassword,
        role: userData.role
      });
      
      console.log(`Usuario ${newUser.username} creado con éxito (ID: ${newUser.id})`);
    }
    
    console.log('Operación completada');
  } catch (error) {
    console.error('Error al crear usuarios predefinidos:', error);
  } finally {
    // Cerrar la conexión a la base de datos
    await pool.end();
  }
}

// Ejecutar la función
createPredefinedUsers();