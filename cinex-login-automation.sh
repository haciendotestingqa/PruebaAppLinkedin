#!/bin/bash

echo "🚀 Iniciando automatización del flujo de login de CineX Movil"
echo "============================================================"
echo "💡 Nota: Usando coordenadas porque la app es WebView"
echo "   Para mayor robustez considera Chrome DevTools (ver cinex-web-automation.js)"
echo ""

# Paso 1: Abrir la app CineX Movil
echo "📱 Paso 1: Abriendo la app CineX Movil..."
adb shell monkey -p com.evenprocinex.webmovil -c android.intent.category.LAUNCHER 1
sleep 3

# Paso 2: Hacer click en menú hamburguesa (zona superior derecha)
echo "🍔 Paso 2: Haciendo click en menú hamburguesa..."
adb shell input tap 950 100
sleep 2

# Paso 3: Hacer click en "Iniciar Sesión" en el menú lateral
echo "🔑 Paso 3: Haciendo click en 'Iniciar Sesión'..."
echo "   💡 Usando coordenadas 300,550 (posición en menú lateral)"
echo "   💡 Para más robustez: usar selectores CSS o Chrome DevTools"
adb shell input tap 300 550
sleep 2

echo "✅ Flujo actualizado completado"
echo ""
echo "📝 Próximos pasos a agregar:"
echo "   - Ingresar usuario"
echo "   - Ingresar contraseña"
echo "   - Hacer click en 'Entrar'"
echo ""
echo "🔧 Mejoras disponibles:"
echo "   - cinex-web-automation.js: Usa Chrome DevTools para selectores reales"
echo "   - YAML actualizado: Incluye comentarios para selectores web"
