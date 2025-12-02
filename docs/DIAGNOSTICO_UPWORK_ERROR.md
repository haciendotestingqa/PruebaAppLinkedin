# Diagnóstico: Error "Due to technical difficulties" en Upwork

## Posibles Causas del Error (Ordenadas por Probabilidad)

### 1. **Detección de Automatización (MÁS PROBABLE - ~70%)**
**Síntomas:**
- El error aparece inmediatamente después de ingresar datos
- El error aparece después de hacer clic en "Log in"
- `navigator.webdriver` está siendo detectado

**Causas específicas:**
- WebDriver flags expuestos
- Patrones de comportamiento no humanos (velocidad constante, sin variación)
- Headers de automatización visibles
- Falta de interacciones humanas (movimientos de mouse, scroll)

**Cómo descartar:**
1. Revisar en la consola del navegador: `navigator.webdriver` (debe ser `undefined`, no `true`)
2. Verificar en los logs del diagnóstico si aparece "WebDriver detectado: SÍ"
3. Probar manualmente el login para ver si funciona sin automatización

**Soluciones:**
- ✅ Ya implementado: Delays aleatorios
- ✅ Ya implementado: Movimientos de mouse
- ✅ Ya implementado: Hover antes de clic
- ⚠️ Verificar: Headers anti-detección

### 2. **Rate Limiting / Bloqueo Temporal (~15%)**
**Síntomas:**
- El error aparece después de múltiples intentos
- El error aparece incluso con credenciales correctas
- Funciona después de esperar varios minutos/horas

**Cómo descartar:**
1. Esperar 30-60 minutos y volver a intentar
2. Verificar si el login manual funciona
3. Revisar si hay múltiples intentos recientes en los logs

**Soluciones:**
- Esperar más tiempo entre intentos (actualmente 10 seg entre plataformas)
- Limpiar cookies antes de cada intento
- Usar IP diferente o VPN

### 3. **Problemas de Timing / Solicitud Prematura (~10%)**
**Síntomas:**
- El error aparece justo después de hacer clic en "Log in"
- El error desaparece si esperas manualmente más tiempo
- El formulario parece no estar completamente listo

**Cómo descartar:**
1. Revisar en los logs del diagnóstico el tiempo de espera
2. Probar manualmente: ingresar password, esperar 10-15 segundos, luego hacer clic
3. Verificar si aumentar los delays resuelve el problema

**Soluciones:**
- ✅ Ya implementado: Espera de 5-8 segundos antes de buscar botón
- ⚠️ Aumentar a 10-15 segundos si persiste
- Verificar que el formulario esté completamente cargado

### 4. **Problemas con Cookies/Sesión (~3%)**
**Síntomas:**
- El error aparece después del consentimiento de Google
- Las cookies no se guardan correctamente
- Sesión expira durante el proceso

**Cómo descartar:**
1. Revisar en Network tab las cookies en las requests
2. Verificar si las cookies se establecen correctamente después del consentimiento
3. Limpiar todas las cookies y volver a intentar

### 5. **Problemas con Headers HTTP (~2%)**
**Síntomas:**
- El error aparece en requests específicas
- Headers faltantes o incorrectos en Network tab

**Cómo descartar:**
1. Revisar Network tab → encontrar la request que falla
2. Comparar headers con una request manual exitosa
3. Verificar User-Agent y otros headers importantes

## Plan de Diagnóstico Sistemático - Paso a Paso

### PASO 1: Ejecutar el proceso y capturar información
1. **Abrir la app y hacer clic en "Iniciar Sesión" para Upwork**
2. **Abrir las DevTools (F12) y activar:**
   - Pestaña **Console** (para ver logs)
   - Pestaña **Network** (para ver requests)
   - Filtro: Solo mostrar errores (icono de filtro → "Failed")

3. **Observar y anotar:**
   - ¿En qué momento aparece el error? (antes/durante/después del clic en "Log in")
   - ¿Qué request falla en Network tab?
   - ¿Qué dice la consola cuando aparece el error?

### PASO 2: Revisar los logs del diagnóstico
Los logs del sistema ahora incluyen:
- `[DIAGNÓSTICO]` - Información detallada en múltiples puntos
- Estado del password field
- Estado del botón login
- Detección de WebDriver
- Timestamp de cuando aparece el error

**Busca en los logs:**
- `🔍 [DIAGNÓSTICO]` - Ver toda la información capturada
- `WebDriver detectado: SÍ` - Indica detección de automatización
- `Error presente: true` - Cuándo aparece el error

### PASO 3: Verificar Network Tab
1. **Buscar la request que falla:**
   - Filtra por "Failed" o errores (rojo)
   - Busca requests a `/login`, `/signin`, o endpoints de autenticación

2. **Revisar la request que falla:**
   - Click derecho → "Copy" → "Copy as cURL" o "Copy request"
   - Revisar:
     - Status code (400, 403, 429, 500?)
     - Response body (¿qué dice el error?)
     - Headers enviados
     - Payload/Form data

3. **Comparar con request exitosa (si tienes una manual):**
   - Headers diferentes
   - Payload diferente
   - Cookies diferentes

### PASO 4: Probar manualmente
1. **Hacer el proceso completo manualmente:**
   - Abrir Upwork login
   - Hacer todo el flujo paso a paso
   - Ver si aparece el error

2. **Si funciona manualmente pero no automáticamente:**
   - ✅ Confirma que es detección de automatización
   - Revisa qué es diferente en el comportamiento manual

3. **Si también falla manualmente:**
   - Puede ser problema de credenciales
   - Puede ser bloqueo temporal de la cuenta
   - Puede ser problema del servidor de Upwork

### PASO 5: Verificar credenciales y estado de cuenta
1. **Verificar que las credenciales sean correctas:**
   - Probar login manual con las mismas credenciales
   - Verificar que la cuenta no esté bloqueada

2. **Verificar estado de la cuenta:**
   - ¿Hay verificaciones pendientes?
   - ¿La cuenta requiere acción manual?
   - ¿Hay notificaciones o alertas en la cuenta?

## Información a Capturar para Diagnóstico

Cuando ejecutes el proceso, captura:

### 1. Desde Console (Logs del Sistema):
```
🔍 [DIAGNÓSTICO] Estado antes de ingresar password:
  - URL: ...
  - Error presente: ...
  - WebDriver detectado: ...
  - Cookies presentes: ...
```

### 2. Desde Network Tab:
- Request que falla (nombre y URL)
- Status code de la respuesta
- Response body (copia el texto completo)
- Headers de la request (especialmente User-Agent, Referer, Cookies)

### 3. Desde la Página:
- Screenshot del error
- URL exacta cuando aparece el error
- Hora exacta (timestamp)

## Soluciones Inmediatas a Probar

### Solución 1: Aumentar tiempos de espera
Si el error aparece muy rápido, puede ser timing:
- Ya aumentado a 5-8 segundos después de password
- Si persiste, aumentar a 10-15 segundos

### Solución 2: Limpiar cookies antes de empezar
```javascript
// Agregar al inicio del proceso
await page.deleteCookie(...await page.cookies())
```

### Solución 3: Mejorar anti-detección
- Ya implementado: Delays aleatorios
- Ya implementado: Movimientos de mouse
- Pendiente: Mejorar headers

### Solución 4: Esperar más tiempo entre intentos
- No intentar login múltiples veces seguidas
- Esperar al menos 5-10 minutos entre intentos

## Próximos Pasos

1. **Ejecuta el proceso una vez** y copia TODOS los logs que aparezcan
2. **Captura la información de Network tab** cuando aparece el error
3. **Comparte la información** para identificar la causa específica
4. **Basado en la información**, aplicaremos la solución específica

## Comandos Útiles para Diagnóstico

En la consola del navegador durante el proceso:

```javascript
// Verificar WebDriver
console.log('WebDriver:', navigator.webdriver)

// Ver todas las cookies
console.log('Cookies:', document.cookie)

// Ver estado del formulario
console.log('Form:', document.querySelector('form'))

// Ver errores en la página
console.log('Errors:', document.querySelectorAll('[role="alert"], .error'))
```

