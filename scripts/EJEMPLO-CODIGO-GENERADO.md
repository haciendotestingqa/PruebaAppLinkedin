# 📝 Ejemplo de Código Generado

Cuando grabes tu flujo de login con Playwright Codegen, se generará algo así:

```typescript
import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  // Ir a la página de login
  await page.goto('https://www.upwork.com/ab/account-security/login');
  
  // Clic en botón "Sign in with Google"
  await page.getByRole('button', { name: 'Sign in with Google' }).click();
  
  // Esperar a que se abra el popup de Google
  const page1 = await page.context().waitForEvent('page');
  await page1.waitForLoadState();
  
  // Ingresar email en el campo de Google
  await page1.getByLabel('Email or phone').click();
  await page1.getByLabel('Email or phone').fill('tu-email@gmail.com');
  
  // Clic en botón "Next"
  await page1.getByRole('button', { name: 'Next' }).click();
  
  // Esperar campo de password
  await page1.getByLabel('Enter your password').click();
  await page1.getByLabel('Enter your password').fill('tu-password');
  
  // Clic en botón "Next" de password
  await page1.getByRole('button', { name: 'Next' }).click();
  
  // Esperar redirección a Upwork
  await page.waitForURL('**/upwork.com/**');
  
  // Verificar que el login fue exitoso
  await expect(page).toHaveURL(/upwork\.com/);
});
```

## 🔄 Cómo adaptar este código a tu función

Puedes adaptar este código generado a tu función `loginUpwork` así:

```typescript
export async function loginUpwork(credentials: PlatformCredentials): Promise<AuthSession | null> {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Todo el código generado aquí...
    await page.goto('https://www.upwork.com/ab/account-security/login');
    await page.getByRole('button', { name: 'Sign in with Google' }).click();
    // etc...
    
    // Obtener cookies y user agent
    const cookies = await context.cookies();
    const userAgent = await page.evaluate(() => navigator.userAgent);
    
    await browser.close();
    
    return {
      cookies,
      userAgent,
      isAuthenticated: true
    };
  } catch (error) {
    await browser.close();
    return null;
  }
}
```

## 💡 Ventajas del código generado

- ✅ **Selectores precisos**: Playwright encuentra los mejores selectores
- ✅ **Manejo de popups**: Detecta automáticamente cuando se abren nuevas ventanas
- ✅ **Esperas automáticas**: Incluye esperas necesarias para que la página cargue
- ✅ **Código limpio**: Código bien estructurado y fácil de leer
- ✅ **Listo para usar**: Puedes copiar y pegar directamente

## 🎯 Pasos para usar el código generado

1. Graba tu flujo: `npm run record:upwork`
2. Abre el archivo generado: `scripts/generated/upwork-login-recorded.ts`
3. Copia las líneas relevantes
4. Pégalas en tu función `loginUpwork`
5. Ajusta las credenciales para usar `credentials.email` y `credentials.password`
6. Reemplaza `test` y `expect` con tu lógica de retorno





