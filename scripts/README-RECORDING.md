# 🎬 Grabación de Flujo de Inicio de Sesión con Playwright

Este script te permite grabar manualmente el flujo de inicio de sesión para cualquier plataforma y generar código automático basado en tus acciones.

## 📋 Cómo Usar

### 1. Instalar Playwright (si no está instalado)

```bash
npx playwright install chromium
```

### 2. Grabar un flujo de inicio de sesión

#### ⭐ Opción Recomendada: Usar Playwright Codegen (Simple)

```bash
# Para Upwork
npm run record:upwork

# Para Glassdoor
npm run record:glassdoor

# Para Indeed
npm run record:indeed

# Para Hireline
npm run record:hireline
```

Esto abrirá:
- **Un navegador interactivo** donde puedes hacer el login manualmente
- **Una ventana de Codegen** que muestra el código generado en tiempo real
- **Archivo de salida**: `scripts/generated/<platform>-login-recorded.ts`

**Pasos:**
1. Se abrirá el navegador con la página de login
2. Haz tu login normalmente (clic en botones, ingresa email/password, etc.)
3. Cada acción que hagas se registrará automáticamente en Codegen
4. Cuando termines, cierra la ventana de Codegen
5. El código se guardará automáticamente en `scripts/generated/`

#### Opción Avanzada: Script personalizado (con más detalles)

```bash
# Para Upwork
npm run record:upwork:advanced

# Para Glassdoor
npm run record:glassdoor:advanced

# Para Indeed
npm run record:indeed:advanced

# Para Hireline
npm run record:hireline:advanced
```

Este método genera:
- Código TypeScript
- JSON con todas las acciones registradas
- Traza de Playwright para análisis

#### Opción Manual: Playwright Codegen directo

```bash
# Para Upwork
npx playwright codegen --target=typescript --output=scripts/generated/upwork-login.ts https://www.upwork.com/ab/account-security/login

# Para Glassdoor
npx playwright codegen --target=typescript --output=scripts/generated/glassdoor-login.ts https://www.glassdoor.com/profile/login_input.htm

# Para Indeed
npx playwright codegen --target=typescript --output=scripts/generated/indeed-login.ts https://secure.indeed.com/account/login
```

### 3. Proceso de Grabación

Cuando ejecutas el script:

1. **Se abrirá un navegador automáticamente** con la página de inicio de sesión
2. **Se abrirá una ventana de Codegen** que muestra el código generado en tiempo real
3. **Interactúa normalmente** con el navegador:
   - Haz clic en botones
   - Ingresa tu email y contraseña
   - Completa cualquier captcha o verificación
   - Navega por las páginas necesarias
   - Cada acción se registrará automáticamente
4. **Cierra la ventana de Codegen** cuando termines
5. El código se guardará automáticamente

### 4. Resultados

El script generará varios archivos:

- **Código TypeScript**: `scripts/generated/<platform>-login-recorded.ts`
  - Código listo para usar basado en tus acciones
  
- **JSON de acciones**: `recordings/<platform>-login-actions.json`
  - Todas las acciones registradas en formato JSON
  
- **Traza de Playwright**: `recordings/<platform>-login-trace.zip`
  - Traza completa que puedes reproducir con Playwright

### 5. Usar el Código Generado

Una vez generado, puedes:

1. **Revisar el código generado** en `scripts/generated/<platform>-login-recorded.ts`
2. **Copiar las partes relevantes** a tu función de login en `lib/platform-auth.ts`
3. **Ajustar selectores** si es necesario
4. **Agregar manejo de errores** y verificaciones adicionales

## 🔧 Configuración

### Modificar URLs de inicio

Edita el archivo `scripts/record-login.ts` y modifica el objeto `urls`:

```typescript
const urls = {
  upwork: 'https://www.upwork.com/ab/account-security/login',
  glassdoor: 'https://www.glassdoor.com/profile/login_input.htm',
  indeed: 'https://secure.indeed.com/account/login',
  hireline: 'https://hireline.io/login'
}
```

### Personalizar selectores

Si necesitas personalizar cómo se generan los selectores, edita la función `getSelector` en `scripts/record-login.ts`.

## 📝 Ejemplo de Uso

```bash
# 1. Iniciar grabación para Upwork
npm run record:upwork

# 2. En el navegador que se abre:
#    - Haz clic en "Sign in with Google"
#    - Ingresa tu email de Google
#    - Ingresa tu contraseña
#    - Completa el login
#    - Presiona Enter en la terminal

# 3. Revisa el código generado en:
#    scripts/generated/upwork-login-recorded.ts

# 4. Copia y adapta el código a tu función loginUpwork
```

## 🎯 Ventajas sobre Puppeteer

- ✅ **Grabación automática** de acciones
- ✅ **Codegen integrado** para generar código
- ✅ **Trazas visuales** para debugging
- ✅ **Mejor manejo de frames y popups**
- ✅ **API más moderna y robusta**

## 🐛 Solución de Problemas

### Error: "playwright not found"

```bash
npx playwright install chromium
```

### El navegador no se abre

Asegúrate de tener Chromium instalado:
```bash
npx playwright install chromium
```

### Los selectores no funcionan

Revisa el código generado y ajusta los selectores manualmente si es necesario.

## 📚 Referencias

- [Playwright Documentation](https://playwright.dev/)
- [Playwright Codegen](https://playwright.dev/docs/codegen)

