# 🚀 Inicio Rápido - Grabación de Login con Sesión

## Pasos Rápidos

### 1. Instalar Playwright (primera vez)
```bash
npx playwright install chromium
```

### 2. Abrir Chrome para login manual
```bash
npm run open:chrome upwork
```

### 3. En Chrome que se abre:
- Ve a la página de login si no estás ahí
- Haz login manualmente (email, contraseña, etc.)
- Navega por la plataforma para probar que funciona
- **NO cierres Chrome todavía**

### 4. Registrar la sesión autenticada
```bash
npm run record:session upwork
```

### 5. Revisar el código generado
```bash
cat scripts/generated/upwork-session-recorded.ts
```

### 6. Probar el login automático
- El código generado usa las cookies de tu sesión
- Si la sesión expira, tiene fallback a login manual
- Copia la función a `lib/platform-auth.ts`

## 📝 Para Otras Plataformas

Sigue los mismos pasos pero cambiando la plataforma:

```bash
# 1. Abrir Chrome para login manual
npm run open:chrome glassdoor
npm run open:chrome indeed
npm run open:chrome hireline
npm run open:chrome linkedin

# 2. Registrar la sesión autenticada
npm run record:session glassdoor
npm run record:session indeed
npm run record:session hireline
npm run record:session linkedin
```

## 🎯 Ventajas

- ✅ **Login manual**: Tú controlas el proceso de autenticación
- ✅ **Captura de sesión**: Registra cookies y datos de sesión reales
- ✅ **Código funcional**: Incluye datos de autenticación reales
- ✅ **Fallback automático**: Si la sesión expira, puede hacer login manual
- ✅ **Sin grabación compleja**: No necesitas recordar secuencias exactas

## 💡 Tips

- Mantén Chrome abierto entre los pasos
- Si la sesión expira, repite el proceso
- Las cookies pueden durar días o semanas
- Puedes reutilizar el mismo Chrome para múltiples plataformas
- Si hay cambios en la UI, puede que necesites repetir





