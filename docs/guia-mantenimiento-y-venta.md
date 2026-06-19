# Guia de mantenimiento y venta de Bares Turnos

## Para que sirve este documento

Esta guia esta pensada para dos personas que van a vender la aplicacion y no quieren depender de un programador para cada error.

La idea no es aprender todo React ni todo Supabase.

La idea es saber estas 3 cosas:

1. Como esta montada la app.
2. Que archivos tocan cada funcion importante.
3. Donde mirar y que revisar cuando algo falla.

Si os quedais con una sola idea, que sea esta:

`casi todos los errores se arreglan mirando 3 capas`

1. La pantalla de frontend en `src/pages/...`
2. La API en `api/...`
3. La tabla de Supabase donde se guarda el dato

En login y permisos hay una cuarta capa:

4. La autenticacion de Supabase y las variables de entorno

---

## Resumen rapido de la arquitectura

La app tiene 4 piezas principales:

1. `Frontend React + Vite`
   Vive en `src/`
   Es lo que ve el usuario en navegador.

2. `APIs serverless`
   Viven en `api/`
   Son funciones que hablan con la base de datos usando permisos altos.

3. `Supabase`
   Guarda usuarios, bares, turnos, tareas, chat e invitaciones.

4. `Vercel`
   Publica la web y ejecuta las funciones de `api/`.

Flujo real:

`navegador -> pagina React -> fetch /api/... -> funcion en Vercel -> Supabase`

---

## Mapa del proyecto

### Archivos de entrada

- `src/main.tsx`
  Arranca React.

- `src/App.tsx`
  Define rutas y monta la autenticacion.
  Aqui tambien se llama `handleGoogleRedirect()`.

- `src/contexts/AuthContext.jsx`
  Es el corazon de la sesion.
  Guarda `user`, `profile`, `myBars`, `activeBar` y recarga datos globales.

- `src/lib/supabase.js`
  Cliente Supabase del navegador.

- `api/db-client.js`
  Cliente Supabase del servidor.
  Usa `SUPABASE_SERVICE_ROLE_KEY`, o sea, permisos altos.

### Pantallas principales

- `src/pages/Login.jsx`
  Login con email/password y login con Google.

- `src/pages/Onboarding.jsx`
  Pantalla para elegir entre jefe y trabajador.
  Aqui se crea el bar o se aceptan invitaciones.

- `src/pages/Calendar.jsx`
  Calendario y turnos.

- `src/pages/Tasks.jsx`
  Tareas generales e individuales, urgencias y completados.

- `src/pages/Chat.jsx`
  Chat privado entre jefe y trabajador o entre trabajadores.

- `src/pages/Admin.jsx`
  Equipo, invitaciones, cambio de roles y nombre del bar.

- `src/pages/Invitations.jsx`
  Lista de invitaciones pendientes para el trabajador.

### Componentes que importan de verdad

- `src/components/Layout.jsx`
  Cabecera, navegacion, selector de bar, foto de perfil y punto rojo del chat.

- `src/components/ProtectedRoute.jsx`
  Bloquea acceso si el usuario no tiene sesion.

- `src/components/Avatar.jsx`
  Renderiza foto o inicial del usuario.

### APIs importantes

- `api/users.js`
- `api/bars.js`
- `api/bar-members.js`
- `api/invitations.js`
- `api/my-bar.js`
- `api/shifts.js`
- `api/tasks.js`
- `api/task-completions.js`
- `api/messages.js`

---

## Como arranca la app

Orden real de arranque:

1. `src/main.tsx` monta React.
2. `src/App.tsx` llama `handleGoogleRedirect()` y monta rutas.
3. `AuthProvider` en `src/contexts/AuthContext.jsx` pregunta a Supabase si hay sesion activa.
4. Si hay usuario:
   - crea o recupera perfil en `/api/users`
   - carga bares en `/api/my-bar`
   - carga invitaciones en `/api/invitations`
5. `ProtectedRoute` deja entrar o manda a `/login`.
6. `Layout` monta cabecera, menu, avatar y estado del chat.

Si alguna de esas piezas falla, la app puede:

- mandar siempre a login
- quedarse cargando
- entrar pero sin datos
- entrar pero sin bar activo

---

## Servicios externos que teneis que controlar

Para vender bien esta app, no basta con tener el codigo. Teneis que controlar estos accesos:

1. `GitHub`
   Para el codigo fuente.

2. `Vercel`
   Para despliegue, variables de entorno y logs.

3. `Supabase`
   Para autenticacion, base de datos y politicas.

4. `Google Cloud OAuth`
   Para el login con Google.

5. `VITE_GOOGLE_AUTH_PROXY`
   Muy importante.
   El login con Google depende de una URL externa que NO vive dentro de este repo.
   Si esa URL deja de existir o no la controlais, Google login deja de funcionar aunque el resto del codigo este perfecto.

6. `FULLSTACK_RESTORE_API_URL`
   Es otra dependencia externa opcional.
   Sirve para "despertar" o restaurar el backend si Supabase responde con errores 500.

Si vais a vender el producto, este punto es critico:

`sin control de Supabase, Google OAuth y la URL del proxy de Google, no controlais del todo la app`

---

## Variables de entorno

Las variables esperadas estan en [`.env.example`](/Users/pc/Downloads/agon-agent_1-77053866/.env.example:1).

### Variables del navegador

- `VITE_SUPABASE_URL`
  URL del proyecto Supabase para el frontend.

- `VITE_SUPABASE_ANON_KEY`
  Clave publica de Supabase para el frontend.

- `VITE_GOOGLE_CLIENT_ID`
  Cliente OAuth de Google.

- `VITE_GOOGLE_AUTH_PROXY`
  URL externa que recibe el callback de Google.

### Variables del servidor

- `NEXT_PUBLIC_SUPABASE_URL`
  URL que usan las funciones `api/`.

- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  No es la clave principal del servidor, pero se conserva en la configuracion.

- `SUPABASE_SERVICE_ROLE_KEY`
  La mas delicada.
  Si falla, casi todas las APIs fallan.

- `FULLSTACK_PROJECT_REF`
  Referencia del proyecto para el sistema de restore.

- `FULLSTACK_RESTORE_API_URL`
  Endpoint usado para intentar despertar el proyecto.

### Que rompe cada una si falta

- Si falta `VITE_SUPABASE_URL` o `VITE_SUPABASE_ANON_KEY`:
  no funcionara login, sesion ni cliente Supabase en navegador.

- Si falta `SUPABASE_SERVICE_ROLE_KEY`:
  fallaran las APIs de `api/`.

- Si falta `VITE_GOOGLE_CLIENT_ID` o `VITE_GOOGLE_AUTH_PROXY`:
  fallara Google login.

- Si faltan `FULLSTACK_*`:
  la app puede funcionar, pero no tendra auto-restore si Supabase cae con errores 500.

---

## Base de datos: tablas que importan

No hace falta memorizar SQL. Si hace falta saber que guarda cada tabla.

### `users`

Guarda el perfil de la persona dentro de la app.

Campos usados por el codigo:

- `id`
- `email`
- `display_name`
- `role`
- `avatar_url`
- `created_at`
- `updated_at`

Se usa en:

- `src/contexts/AuthContext.jsx`
- `api/users.js`

### `bars`

Guarda cada bar.

Campos usados:

- `id`
- `name`
- `owner_id`
- `created_at`

Se usa en:

- `api/bars.js`
- `api/my-bar.js`
- `api/invitations.js`

### `bar_members`

Relaciona usuarios con bares.

Campos usados:

- `bar_id`
- `user_id`
- `role`
- `joined_at`

Se usa en:

- `api/bar-members.js`
- `api/my-bar.js`
- `api/messages.js`

### `invitations`

Invitaciones para unirse a un bar.

Campos usados:

- `id`
- `bar_id`
- `email`
- `invited_by`
- `status`
- `user_id`
- `created_at`

Se usa en:

- `api/invitations.js`
- `src/pages/Onboarding.jsx`
- `src/pages/Invitations.jsx`
- `src/pages/Admin.jsx`

### `shifts_v2`

Turnos del calendario.

Campos usados:

- `id`
- `bar_id`
- `user_id`
- `date`
- `start_time`
- `end_time`
- `notes`

Se usa en:

- `api/shifts.js`
- `src/pages/Calendar.jsx`

### `tasks_v2`

Es la tabla mas delicada del proyecto.

No solo guarda tareas.
Tambien guarda mensajes del chat.

Campos usados:

- `id`
- `bar_id`
- `title`
- `description`
- `created_by`
- `priority`
- `is_active`
- `created_at`

Se usa en:

- `api/tasks.js`
- `api/messages.js`
- `src/pages/Tasks.jsx`
- `src/pages/Chat.jsx`

### `task_completions`

Guarda quien ha completado cada tarea.

Campos usados:

- `id`
- `task_id`
- `user_id`
- `completed_at`

Se usa en:

- `api/task-completions.js`
- `src/pages/Tasks.jsx`

---

## Dos detalles tecnicos muy importantes que no son obvios

### 1. El chat NO tiene su propia tabla

El chat se guarda en `tasks_v2`.

`api/messages.js` crea filas con:

- `title = "__private_chat_message__"`
- `is_active = false`

Y mete metadatos dentro de `description` usando marcas invisibles:

```text
<!--chat_to:USER_ID-->
<!--read_at:FECHA_OPCIONAL-->
Mensaje real
```

Consecuencia:

- si alguien limpia `tasks_v2` sin excluir esos registros, rompe el chat
- si alguien cambia `api/tasks.js` o `api/messages.js` sin saber esto, puede romper tareas y chat a la vez

### 2. Turnos y tareas guardan metadatos dentro de texto

No todo va en columnas normales.

#### En turnos

`src/pages/Calendar.jsx` guarda el tipo de turno dentro de `notes` con una marca:

```text
<!--shift_type:afternoon-->
Texto libre de notas
```

Si alguien edita `notes` a mano y borra esa marca, la UI puede perder el tipo real del turno.

#### En tareas

`api/tasks.js` guarda prioridad y asignacion dentro de `description`:

```text
<!--priority:urgent-->
<!--assigned_to:USER_ID-->
Descripcion real
```

Si se borra o corrompe ese formato, la tarea puede:

- perder prioridad
- dejar de salir como individual
- volver a parecer general

---

## El patron mental correcto para arreglar errores

Para casi todo, seguid siempre esta secuencia:

1. Mirar la pantalla que falla en `src/pages/...`
2. Ver que endpoint llama esa pantalla
3. Abrir la API correspondiente en `api/...`
4. Identificar la tabla de Supabase que usa
5. Ver logs del navegador y de Vercel
6. Comprobar si faltan variables de entorno

Ejemplo:

`falla el login con Google`

1. Mirar `src/pages/Login.jsx`
2. Mirar `src/lib/googleAuth.js`
3. Revisar variables `VITE_GOOGLE_CLIENT_ID` y `VITE_GOOGLE_AUTH_PROXY`
4. Revisar configuracion de Google y Supabase Auth

---

## Donde arreglar cada parte del producto

### Login con email y password

Archivos clave:

- [`src/pages/Login.jsx`](/Users/pc/Downloads/agon-agent_1-77053866/src/pages/Login.jsx:1)
- [`src/contexts/AuthContext.jsx`](/Users/pc/Downloads/agon-agent_1-77053866/src/contexts/AuthContext.jsx:1)
- [`src/lib/supabase.js`](/Users/pc/Downloads/agon-agent_1-77053866/src/lib/supabase.js:1)
- [`api/users.js`](/Users/pc/Downloads/agon-agent_1-77053866/api/users.js:1)

Que hace:

- `Login.jsx` llama a `supabase.auth.signInWithPassword()` o `signUp()`
- `AuthContext.jsx` recupera la sesion
- `AuthContext.jsx` crea el perfil local si no existe
- `/api/users` guarda el perfil en la tabla `users`

### Login con Google

Archivos clave:

- [`src/pages/Login.jsx`](/Users/pc/Downloads/agon-agent_1-77053866/src/pages/Login.jsx:1)
- [`src/lib/googleAuth.js`](/Users/pc/Downloads/agon-agent_1-77053866/src/lib/googleAuth.js:1)
- [`src/App.tsx`](/Users/pc/Downloads/agon-agent_1-77053866/src/App.tsx:1)
- [`src/contexts/AuthContext.jsx`](/Users/pc/Downloads/agon-agent_1-77053866/src/contexts/AuthContext.jsx:1)
- [`api/users.js`](/Users/pc/Downloads/agon-agent_1-77053866/api/users.js:1)

Que hace:

1. `Login.jsx` llama `signInWithGoogle('BarShift')`
2. `googleAuth.js` construye la URL de Google con el proxy de callback
3. Google devuelve el token al proxy
4. El proxy devuelve datos a la app
5. `supabase.auth.setSession()` o `signInWithIdToken()` crea la sesion
6. `AuthContext` crea o recupera perfil

### Onboarding, creacion de bar e invitaciones

Archivos clave:

- [`src/pages/Onboarding.jsx`](/Users/pc/Downloads/agon-agent_1-77053866/src/pages/Onboarding.jsx:1)
- [`src/pages/Invitations.jsx`](/Users/pc/Downloads/agon-agent_1-77053866/src/pages/Invitations.jsx:1)
- [`src/pages/Admin.jsx`](/Users/pc/Downloads/agon-agent_1-77053866/src/pages/Admin.jsx:1)
- [`api/bars.js`](/Users/pc/Downloads/agon-agent_1-77053866/api/bars.js:1)
- [`api/invitations.js`](/Users/pc/Downloads/agon-agent_1-77053866/api/invitations.js:1)
- [`api/bar-members.js`](/Users/pc/Downloads/agon-agent_1-77053866/api/bar-members.js:1)
- [`api/my-bar.js`](/Users/pc/Downloads/agon-agent_1-77053866/api/my-bar.js:1)

Que hace:

- el jefe crea el bar
- el bar se guarda en `bars`
- automaticamente se crea miembro owner en `bar_members`
- el jefe invita por email
- el trabajador acepta
- se crea miembro `worker` en `bar_members`

### Calendario y turnos

Archivos clave:

- [`src/pages/Calendar.jsx`](/Users/pc/Downloads/agon-agent_1-77053866/src/pages/Calendar.jsx:1)
- [`api/shifts.js`](/Users/pc/Downloads/agon-agent_1-77053866/api/shifts.js:1)
- [`api/bar-members.js`](/Users/pc/Downloads/agon-agent_1-77053866/api/bar-members.js:1)

Que hace:

- el jefe puede ver semana/mes y editar
- el trabajador solo ve su semana y semanas anteriores
- los turnos se leen y guardan en `shifts_v2`
- el tipo de turno se codifica dentro de `notes`

### Tareas

Archivos clave:

- [`src/pages/Tasks.jsx`](/Users/pc/Downloads/agon-agent_1-77053866/src/pages/Tasks.jsx:1)
- [`api/tasks.js`](/Users/pc/Downloads/agon-agent_1-77053866/api/tasks.js:1)
- [`api/task-completions.js`](/Users/pc/Downloads/agon-agent_1-77053866/api/task-completions.js:1)

Que hace:

- crea tareas generales o individuales
- guarda prioridad
- marca completados por usuario
- el jefe puede editar y ver quien completo
- el trabajador solo marca su propio completado

### Chat privado y notificaciones

Archivos clave:

- [`src/pages/Chat.jsx`](/Users/pc/Downloads/agon-agent_1-77053866/src/pages/Chat.jsx:1)
- [`src/components/Layout.jsx`](/Users/pc/Downloads/agon-agent_1-77053866/src/components/Layout.jsx:1)
- [`api/messages.js`](/Users/pc/Downloads/agon-agent_1-77053866/api/messages.js:1)

Que hace:

- lista contactos del mismo bar
- guarda mensajes en `tasks_v2`
- marca leidos con `PUT /api/messages`
- pinta punto rojo general en `Layout`
- pinta punto rojo por remitente en `Chat`
- muestra doble check con estado entregado o visto

### Foto de perfil

Archivos clave:

- [`src/components/Layout.jsx`](/Users/pc/Downloads/agon-agent_1-77053866/src/components/Layout.jsx:1)
- [`src/components/Avatar.jsx`](/Users/pc/Downloads/agon-agent_1-77053866/src/components/Avatar.jsx:1)
- [`api/users.js`](/Users/pc/Downloads/agon-agent_1-77053866/api/users.js:1)

Que hace:

- la imagen se recorta a cuadrado
- se convierte a base64
- se guarda en `users.avatar_url`

---

## Incidencias tipicas y como arreglarlas

## 1. Falla el login con Google

Primero mirad:

- `src/lib/googleAuth.js`
- `src/pages/Login.jsx`
- `src/App.tsx`

Checklist:

1. Confirmar que existen `VITE_GOOGLE_CLIENT_ID` y `VITE_GOOGLE_AUTH_PROXY` en Vercel.
2. Confirmar que el proyecto de Google permite ese callback.
3. Confirmar que Supabase tiene Google como proveedor activo.
4. Confirmar que el proxy externo sigue vivo y es vuestro.
5. Revisar consola del navegador para errores que empiecen por `[google-auth]`.
6. Revisar si llega `google_id_token` en la URL o si llega `postMessage`.

Si email/password funciona pero Google no:

`el problema casi seguro esta en googleAuth.js, en variables de entorno, en Supabase Auth o en el proxy externo`

Punto delicado:

`handleGoogleRedirect()` se llama al cargar `src/App.tsx`

Si alguien lo quita, el retorno de Google puede dejar de funcionar.

## 2. El usuario entra pero no tiene perfil

Mirad:

- `src/contexts/AuthContext.jsx`
- `api/users.js`

Donde rompe:

- `ensureProfileExists()`
- `POST /api/users`

Sintoma tipico:

- hay sesion de Supabase
- pero no aparece nombre, foto o datos del usuario

## 3. El usuario entra pero no ve su bar

Mirad:

- `api/my-bar.js`
- `api/bar-members.js`
- `api/invitations.js`
- `src/contexts/AuthContext.jsx`

Checklist:

1. Ver si existe fila en `bar_members` para ese `user_id`
2. Ver si la invitacion sigue en `pending`
3. Ver si `refreshAll()` se ha ejecutado despues de aceptar invitacion

## 4. No se pueden crear o editar turnos

Mirad:

- `src/pages/Calendar.jsx`
- `api/shifts.js`

Checklist:

1. Comprobar que `activeBar.bar_id` existe
2. Comprobar que el usuario es owner si esta intentando editar
3. Comprobar que `formWorker`, `date`, `start_time` y `end_time` se envian
4. Comprobar en Supabase si la tabla usada es `shifts_v2`

Detalle importante:

- el modal nuevo ya no deja editar la fecha a mano
- la fecha sale del dia pulsado o de la semana visible

Si algun dia el modal vuelve a dejar editar fecha, revisad `src/pages/Calendar.jsx`

## 5. Los trabajadores ven mal el calendario

Mirad:

- `src/pages/Calendar.jsx`

Regla actual:

- jefe: puede semana y mes, puede avanzar
- trabajador: solo semana y no puede avanzar a semanas futuras

La logica esta sobre todo en:

- `viewMode`
- `canGoNext`
- `fetchData()`

## 6. Las tareas urgentes no resaltan o se ordenan mal

Mirad:

- `src/pages/Tasks.jsx`
- `api/tasks.js`

Puntos clave:

- el orden sale de `TASK_PRIORITIES`
- el color urgente sale de `isUrgent`
- la prioridad real puede venir de columna o de marcador en `description`

Si la base de datos no tiene columna `priority`, la API usa el archivo local:

- [`.local-task-priorities.json`](/Users/pc/Downloads/agon-agent_1-77053866/.local-task-priorities.json:1)

Eso es un parche de compatibilidad, no una solucion ideal.
Si al vender la app quereis algo mas robusto, conviene asegurar que `tasks_v2.priority` existe de verdad en Supabase.

## 7. Un trabajador puede editar tareas o ver quien completo

Mirad:

- `src/pages/Tasks.jsx`
- `api/tasks.js`
- `api/task-completions.js`

La proteccion esta en dos sitios:

1. En frontend, usando `isOwner`
2. En API, exigiendo `is_owner === true` para crear, editar o borrar tareas

Si algun trabajador puede hacer eso, no mireis solo la UI. Revisad tambien la API.

## 8. El chat no marca leidos, no sale el punto rojo o el doble tick va mal

Mirad:

- `src/pages/Chat.jsx`
- `src/components/Layout.jsx`
- `api/messages.js`

Mapa del comportamiento:

- `Layout.jsx` pide resumen del chat y muestra punto rojo general
- `Chat.jsx` pide resumen por remitente y muestra punto rojo en cada contacto
- `Chat.jsx` hace `PUT /api/messages` con `action: mark_read`
- `api/messages.js` escribe `read_at` dentro del `description`

Si el punto rojo no se quita al abrir chat:

1. revisad `fetchMessages()` en `src/pages/Chat.jsx`
2. revisad el `PUT /api/messages`
3. revisad que `window.dispatchEvent(new CustomEvent('barshift-chat-read'))` siga existiendo

Si el doble check no cambia a visto:

1. comprobad que `read_at` se esta guardando
2. comprobad que el mensaje pertenece al `peer_id` correcto

## 9. La foto de perfil no se guarda

Mirad:

- `src/components/Layout.jsx`
- `api/users.js`

Checklist:

1. El archivo debe ser imagen
2. `imageFileToDataUrl()` debe completar bien
3. `PUT /api/users` debe devolver `200`
4. `refreshProfile()` debe recargar el usuario

## 10. La app en produccion carga pero las APIs devuelven error 500

Mirad:

- `api/db-client.js`
- `api/db-wake.js`
- variables `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`

Que hace el codigo:

- si Supabase devuelve errores 500, `db-client.js` intenta llamar a `triggerRestore()`

Eso ayuda, pero no sustituye revisar:

- logs de Vercel
- estado del proyecto en Supabase
- variables de entorno

---

## Como depurar sin saber mucho codigo

Este es el proceso recomendado:

1. Reproducir el fallo
   Apuntad exactamente que paso, con que usuario y en que pantalla.

2. Abrir herramientas del navegador
   Mirad `Console` y `Network`.

3. Mirar la pantalla relacionada en `src/pages/...`
   Buscad `fetch('/api/...')`.

4. Abrir la API correspondiente en `api/...`
   Mirad que tabla usa y que campos espera.

5. Verificar datos en Supabase
   Comprobad si la fila existe y si tiene los valores esperados.

6. Verificar logs de Vercel
   Muy util cuando falla una API.

7. Verificar variables de entorno
   Sobre todo en auth, Google y acceso a base de datos.

Regla practica:

`si falla la UI pero la API responde bien, el problema suele estar en src/pages/...`

`si falla la API, el problema suele estar en api/... o en Supabase`

`si no hay sesion o auth rara, mirad AuthContext, googleAuth y variables`

---

## Comandos minimos que deberiais saber usar

```bash
npm install
npm run dev
npm run lint
npm run build
```

Para probar rutas API en local:

```bash
curl http://127.0.0.1:5173/api/my-bar?user_id=USER_ID
curl http://127.0.0.1:5173/api/tasks?bar_id=BAR_ID
curl http://127.0.0.1:5173/api/shifts?bar_id=BAR_ID&start_date=2026-06-16&end_date=2026-06-22
```

En desarrollo local, la web corre con Vite y el plugin de [`dev-api-plugin.js`](/Users/pc/Downloads/agon-agent_1-77053866/dev-api-plugin.js:1) sirve las APIs de `api/` dentro del propio `npm run dev`.

Ademas, [`vite.config.ts`](/Users/pc/Downloads/agon-agent_1-77053866/vite.config.ts:1) pasa las variables de `.env.local` a `process.env` para que las APIs locales tambien puedan usar Supabase.

---

## Que no deberiais tocar a ciegas

1. No borrar `handleGoogleRedirect()` de `src/App.tsx`
2. No limpiar `tasks_v2` sin excluir mensajes de chat
3. No editar a mano los marcadores HTML ocultos de tareas, chat y turnos sin saber lo que haceis
4. No subir claves reales al repo
5. No cambiar nombres de tablas sin revisar todas las APIs
6. No mover logica de permisos solo al frontend; las APIs tambien protegen cosas importantes

---

## Checklist de entrega al comprador

Antes de vender, deberiais poder entregar o controlar:

1. Repo GitHub
2. Proyecto Vercel
3. Proyecto Supabase
4. Cliente OAuth de Google
5. URL del proxy de Google y su propiedad
6. Variables de entorno completas
7. Una cuenta jefe de prueba
8. Una cuenta trabajador de prueba
9. Una copia o export del esquema de base de datos
10. Esta guia de mantenimiento

---

## Lo minimo que deberiais aprender de memoria

Si quereis quedaros solo con lo imprescindible, aprended esto:

1. `Login`
   `src/pages/Login.jsx`
   `src/lib/googleAuth.js`
   `src/contexts/AuthContext.jsx`
   `api/users.js`

2. `Bar y equipo`
   `api/bars.js`
   `api/bar-members.js`
   `api/invitations.js`
   `api/my-bar.js`

3. `Turnos`
   `src/pages/Calendar.jsx`
   `api/shifts.js`

4. `Tareas`
   `src/pages/Tasks.jsx`
   `api/tasks.js`
   `api/task-completions.js`

5. `Chat`
   `src/pages/Chat.jsx`
   `src/components/Layout.jsx`
   `api/messages.js`

6. `Infraestructura`
   `.env.local`
   Vercel envs
   Supabase
   Google OAuth

Si dominiais esas 6 areas, podreis resolver la gran mayoria de incidencias reales.

---

## Recomendacion final

Para vender esta app con tranquilidad, yo trataria como "documentacion obligatoria" estos tres conceptos:

1. El chat se guarda en `tasks_v2`
2. Google login depende de un proxy externo
3. Casi todos los cambios pasan por `pagina + API + tabla`

Con eso claro, ya no vais a ir a ciegas cuando aparezca un error.