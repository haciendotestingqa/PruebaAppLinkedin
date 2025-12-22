#!/bin/bash

echo "📊 MONITOREO DE GRABACIÓN DE LINKEDIN"
echo "===================================="
echo ""
echo "Este script muestra el código generado en tiempo real."
echo "Ejecuta esto en una terminal separada mientras grabas."
echo ""
echo "Presiona Ctrl+C para salir del monitoreo."
echo ""

# Monitorear cambios en el archivo
tail -f scripts/generated/linkedin-login-recorded.ts
