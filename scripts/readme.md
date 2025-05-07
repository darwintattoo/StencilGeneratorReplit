# Scripts de Utilidad para TattooStencilPro

Este directorio contiene scripts útiles para la administración del sistema.

## create-default-users.ts

Este script crea usuarios predefinidos en el sistema, útil cuando el registro público está desactivado.

### Usuarios predefinidos:

1. **Admin**
   - Username: admin
   - Email: admin@tattoostencilpro.com
   - Contraseña: adminpassword123 (cambiar en producción)
   - Rol: admin

2. **Demo**
   - Username: demo
   - Email: demo@tattoostencilpro.com  
   - Contraseña: demopassword123 (cambiar en producción)
   - Rol: user

### Cómo ejecutar:

```bash
# Ejecutar el script
npx tsx scripts/create-default-users.ts
```

## Notas de seguridad

- Cambia las contraseñas predefinidas antes de usar en producción
- Este script sólo creará los usuarios si no existen ya en la base de datos