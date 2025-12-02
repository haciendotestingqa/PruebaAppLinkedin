#!/bin/bash

# Script de prueba rápida para ver cómo funciona la grabación

echo "🎬 Probando la grabación con Playwright Codegen..."
echo ""
echo "📝 Esto es lo que pasará:"
echo "   1. Se abrirá un navegador con Google"
echo "   2. Se abrirá una ventana de Codegen"
echo "   3. Haz clic y escribe en el navegador"
echo "   4. Verás el código generándose en tiempo real en Codegen"
echo "   5. Cuando termines, cierra Codegen"
echo "   6. El código se guardará en scripts/generated/test-recording.ts"
echo ""
echo "💡 Presiona Enter para comenzar..."
read

npx playwright codegen \
  --target=typescript \
  --output=scripts/generated/test-recording.ts \
  https://www.google.com

echo ""
echo "✅ Prueba completada!"
echo "📄 Revisa el código generado en: scripts/generated/test-recording.ts"





