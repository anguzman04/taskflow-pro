# Convenciones de Código y Estilo

## Nomenclatura
* **Variables y Funciones:** Utilizar `camelCase` (ej. `fetchUserData`).
* **Componentes / Clases:** Utilizar `PascalCase` (ej. `UserProfile`).
* **Constantes Globales:** Utilizar `UPPER_SNAKE_CASE` (ej. `MAX_RETRY_LIMIT`).
* **Archivos y Carpetas:** Utilizar `kebab-case` o el estándar del framework elegido.

## Formato y Estructura
* Usar 2 espacios para la indentación.
* Priorizar funciones puras y evitar mutar estados globales directamente.
* Cada componente de UI o módulo de lógica pesada debe tener su propio archivo.

## Manejo de Errores y Logs
* Evitar el uso excesivo de `console.log` en producción.
* Utilizar bloques `try/catch` para operaciones asíncronas y llamadas a bases de datos.
* Retornar mensajes de error claros y estructurados hacia el cliente o la consola.

## Control de Versiones
* Utilizar el estándar de Conventional Commits (ej. `feat: añade autenticación`, `fix: corrige error de conexión SQL`).