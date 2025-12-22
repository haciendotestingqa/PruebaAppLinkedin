#!/bin/bash

echo "🔧 DIAGNÓSTICO Y GRABACIÓN DE LINKEDIN"
echo "====================================="
echo ""

echo "📋 VERIFICACIONES PREVIAS:"
echo "1. Verificando instalación de Playwright..."
npx playwright --version || echo "❌ Playwright no instalado"

echo ""
echo "2. Verificando navegadores..."
npx playwright install --dry-run || echo "⚠️ Posible problema con navegadores"

echo ""
echo "3. Verificando permisos del directorio..."
ls -la scripts/generated/ | head -3

echo ""
echo "🚀 INICIANDO GRABACIÓN CON DIAGNÓSTICO..."
echo ""

# Crear backup del archivo anterior si existe
if [ -f "scripts/generated/linkedin-login-recorded.ts" ]; then
    cp scripts/generated/linkedin-login-recorded.ts scripts/generated/linkedin-login-recorded.ts.backup
    echo "📋 Backup creado: linkedin-login-recorded.ts.backup"
fi

echo "🎯 Ejecutando Playwright Codegen..."
echo "💡 COMANDOS ÚTILES DURANTE LA GRABACIÓN:"
echo "   • Abre otra terminal y ejecuta: npm run monitor:linkedin"
echo "   • Para verificar procesos: ps aux | grep playwright"
echo ""

# Ejecutar con configuración más detallada
npx playwright codegen \
  --target=typescript \
  --output=scripts/generated/linkedin-login-recorded.ts \
  --browser=chromium \
  https://www.linkedin.com/login

echo ""
echo "✅ Grabación completada!"
echo ""
echo "🔍 VERIFICACIÓN:"
echo "- Archivo generado: $(ls -la scripts/generated/linkedin-login-recorded.ts)"
echo "- Líneas en archivo: $(wc -l scripts/generated/linkedin-login-recorded.ts)"
echo ""
echo "🧪 PRUEBA:"
echo "npm run test:linkedin:login"
