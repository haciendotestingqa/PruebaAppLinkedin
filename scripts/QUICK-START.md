# 🚀 Inicio Rápido - Grabación de Login

## Pasos Rápidos

### 1. Instalar Playwright (primera vez)
```bash
npx playwright install chromium
```

### 2. Grabar el login de Upwork
```bash
npm run record:upwork
```

### 3. En el navegador que se abre:
- Haz clic en "Sign in with Google"
- Ingresa tu email de Google
- Ingresa tu contraseña
- Completa el login normalmente
- **Cierra la ventana de Codegen** cuando termines

### 4. Revisar el código generado
```bash
cat scripts/generated/upwork-login-recorded.ts
```

### 5. Copiar y adaptar a tu código
- Abre `scripts/generated/upwork-login-recorded.ts`
- Copia las partes relevantes a `lib/platform-auth.ts`
- Ajusta las credenciales para usar las del `.env`

## 📝 Para Otras Plataformas

```bash
npm run record:glassdoor  # Glassdoor
npm run record:indeed     # Indeed
npm run record:hireline   # Hireline
```

## 🎯 Ventajas

- ✅ **Grabación automática**: No necesitas escribir código
- ✅ **Interacción manual**: Puedes hacer el login a tu ritmo
- ✅ **Captcha friendly**: Puedes resolver captchas manualmente
- ✅ **Código listo**: El código generado está listo para usar
- ✅ **Fácil de adaptar**: Solo necesitas ajustar selectores si cambian

## 💡 Tips

- Si los selectores no funcionan después, vuelve a grabar
- Puedes grabar múltiples veces para mejorar el flujo
- El código generado es un buen punto de partida, no necesariamente perfecto





