// Copia y pega TODO este código en la consola del navegador (F12)
// Luego copia el resultado y pégalo aquí en el chat

const profile = JSON.parse(localStorage.getItem('qa_profile'))

console.log('=== RESULTADOS ===')
console.log('1. Tengo perfil?', profile ? '✅ SÍ' : '❌ NO')

if (profile) {
  console.log('2. Nombre:', profile.name)
  console.log('3. Email:', profile.email)
  console.log('4. Experiencia:', profile.totalExperience, 'años')
  console.log('5. Skills detectadas:', profile.skills?.length || 0)
  console.log('6. Lista de skills:', profile.skills?.map(s => s.name))
} else {
  console.log('❌ No hay perfil guardado')
}

console.log('\n=== FIN RESULTADOS ===')
console.log('\n📋 Copia TODO lo de arriba y pégalo en el chat')












