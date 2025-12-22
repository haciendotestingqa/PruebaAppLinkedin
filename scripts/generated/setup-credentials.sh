#!/bin/bash

# 🎯 Script para configurar credenciales de plataformas
# ======================================================

echo "🔐 CONFIGURACIÓN DE CREDENCIALES"
echo "================================"
echo ""

# Verificar si .env ya existe
if [ -f ".env" ]; then
    echo "⚠️  El archivo .env ya existe."
    read -p "¿Quieres sobrescribirlo? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Configuración cancelada."
        exit 1
    fi
fi

echo "📋 Copiando plantilla de credenciales..."
cp .env.example .env

echo ""
echo "✅ Archivo .env creado!"
echo ""
echo "📝 Ahora edita el archivo .env con tus credenciales reales:"
echo "   nano .env"
echo "   # o"
echo "   code .env"
echo ""
echo "🔑 Credenciales importantes:"
echo "   • UPWORK_EMAIL/PASSWORD: Tu cuenta de Google"
echo "   • LINKEDIN_EMAIL/PASSWORD: Tu cuenta de LinkedIn"
echo "   • Las demás son opcionales"
echo ""
echo "🚀 Una vez configurado, puedes probar con:"
echo "   npm run test:manual:login"
