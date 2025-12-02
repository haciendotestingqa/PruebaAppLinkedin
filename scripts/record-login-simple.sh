#!/bin/bash

# Script simple para usar Playwright Codegen para grabar el flujo de login

PLATFORM=$1

if [ -z "$PLATFORM" ]; then
    echo "Uso: ./scripts/record-login-simple.sh <platform>"
    echo "Plataformas disponibles: upwork, glassdoor, indeed, hireline"
    exit 1
fi

case $PLATFORM in
    upwork)
        URL="https://www.upwork.com/ab/account-security/login"
        ;;
    glassdoor)
        URL="https://www.glassdoor.com/profile/login_input.htm"
        ;;
    indeed)
        URL="https://secure.indeed.com/account/login"
        ;;
    hireline)
        URL="https://hireline.io/login"
        ;;
    *)
        echo "Plataforma no reconocida: $PLATFORM"
        echo "Plataformas disponibles: upwork, glassdoor, indeed, hireline"
        exit 1
        ;;
esac

echo "🎬 Iniciando grabación para $PLATFORM..."
echo "📝 Interactúa con el navegador normalmente"
echo "💡 Todos tus pasos serán grabados y el código se generará automáticamente"
echo "⏹️  Cierra el Codegen cuando termines\n"

npx playwright codegen --target=typescript --output=scripts/generated/${PLATFORM}-login-recorded.ts $URL

echo "\n✅ Grabación completada!"
echo "📄 Código generado en: scripts/generated/${PLATFORM}-login-recorded.ts"





