#!/bin/bash

echo "🎯 GRABACIÓN MANUAL DE LINKEDIN LOGIN"
echo "===================================="
echo ""

echo "📋 INSTRUCCIONES:"
echo "1. Se abrirá Playwright Codegen"
echo "2. En el navegador, ve manualmente a: https://www.linkedin.com/login"
echo "3. Realiza el login completo (email, password, cualquier popup)"
echo "4. Cada acción debería aparecer en el panel derecho"
echo "5. Cuando termines, CIERRA la ventana del navegador"
echo "6. El código se guardará automáticamente"
echo ""

echo "🚀 Iniciando Playwright Codegen..."
echo "💡 Si no se abre automáticamente, ejecuta manualmente:"
echo "   npx playwright codegen --target=typescript --output=scripts/generated/linkedin-login-recorded.ts https://www.linkedin.com/login"
echo ""

# Crear directorio si no existe
mkdir -p scripts/generated

# Ejecutar Playwright Codegen
npx playwright codegen \
  --target=typescript \
  --output=scripts/generated/linkedin-login-recorded.ts \
  https://www.linkedin.com/login

echo ""
echo "✅ Grabación completada!"
echo "📄 Código generado en: scripts/generated/linkedin-login-recorded.ts"
echo ""
echo "🔧 PRÓXIMOS PASOS:"
echo "1. Revisa el código generado"
echo "2. Si hay popups, agrega el manejo manual como se explica en el archivo"
echo "3. Prueba con: npm run test:linkedin:login"
