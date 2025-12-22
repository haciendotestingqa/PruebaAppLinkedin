# 📁 Scripts Generados - Plataformas de Autenticación

## 🚀 Inicio Rápido - Configuración

### 1. Configurar Credenciales

```bash
# Opción automática (recomendado)
npm run setup

# O manualmente
cp .env.example .env
nano .env  # Edita con tus credenciales reales
```

### 2. Credenciales por Plataforma

| Plataforma | Email Var | Password Var | Notas |
|------------|-----------|--------------|-------|
| **Upwork** | `UPWORK_EMAIL` | `UPWORK_PASSWORD` | Usa cuenta Google |
| **LinkedIn** | `LINKEDIN_EMAIL` | `LINKEDIN_PASSWORD` | Cuenta LinkedIn |
| **Freelancer** | `FREELANCER_EMAIL` | `FREELANCER_PASSWORD` | + `FREELANCER_USERNAME` |
| **Hireline** | `HIRELINE_EMAIL` | `HIRELINE_PASSWORD` | - |
| **Indeed** | `INDEED_EMAIL` | `INDEED_PASSWORD` | - |
| **Braintrust** | `BRAINTRUST_EMAIL` | `BRAINTRUST_PASSWORD` | - |
| **Glassdoor** | `GLASSDOOR_EMAIL` | `GLASSDOOR_PASSWORD` | - |

### 3. Verificar Configuración

```bash
# Ver qué credenciales están configuradas
npm run check-env
```

## 📋 Plataformas Soportadas

| Plataforma | Estado | Login Manual | Sesión Grabada | Documentación |
|------------|--------|--------------|----------------|---------------|
| Upwork | ✅ Completo | ✅ | ✅ | ✅ |
| Freelancer | 🔄 En desarrollo | ❌ | ❌ | ⚠️ |
| Hireline | 🔄 En desarrollo | ❌ | ❌ | ⚠️ |
| Indeed | 🔄 En desarrollo | ❌ | ❌ | ⚠️ |
| Braintrust | 🔄 En desarrollo | ❌ | ❌ | ⚠️ |
| Glassdoor | 🔄 En desarrollo | ❌ | ❌ | ⚠️ |
| LinkedIn | 🔄 En desarrollo | ❌ | ❌ | ⚠️ |

## 📄 Archivos por Plataforma

Cada plataforma tiene los siguientes archivos (cuando están implementados):

### `platform-login-recorded.ts`
- Código generado con Playwright Codegen
- Contiene los pasos exactos de login
- Base para implementar automatización

### `platform-session-recorded.ts`
- Sesión completa grabada con cookies y localStorage
- Permite login automático sin credenciales
- Generado con `npm run record:session platform`

### `platform-manual-login.ts`
- Script para login completamente manual
- Registra todos los pasos del usuario
- Útil para debugging y desarrollo

## 🚀 Comandos Disponibles

```bash
# Grabar login con Playwright Codegen
npm run record:platform platform

# Grabar sesión completa
npm run record:session platform

# Abrir Chrome para login manual
npm run open:chrome platform

# Probar login específico
npm run test:platform platform
```

## 📝 Notas Importantes

- Los archivos se generan automáticamente con los comandos anteriores
- Las sesiones grabadas expiran y necesitan renovarse
- El código generado es una base que puede necesitar ajustes
- Para producción, considera implementar versiones más robustas
