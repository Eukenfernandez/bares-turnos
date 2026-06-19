# Bares Turnos

Aplicacion web para gestionar turnos, tareas, equipo y chat interno entre jefe y trabajadores.

## Requisitos

- Node.js 20 o superior
- npm
- Un proyecto Supabase configurado

## Instalacion local

1. Instala dependencias:

```bash
npm install
```

2. Crea el archivo de entorno:

```bash
cp .env.example .env.local
```

3. Rellena `.env.local` con las claves de Supabase y Google si se usa login con Google.

4. Arranca la app:

```bash
npm run dev
```

5. Abre la URL que muestre Vite, normalmente:

```text
http://127.0.0.1:5173
```

## Comandos utiles

```bash
npm run lint
npm run build
```

## Produccion

La app esta desplegada en Vercel:

```text
https://agon-agent1-77053866.vercel.app
```

Para desplegar desde GitHub en Vercel, configura las mismas variables de `.env.example` en el panel de variables de entorno del proyecto. No subas claves reales al repositorio.
