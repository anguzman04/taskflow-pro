# Arquitectura del Proyecto

## Descripción General
Este documento define la estructura técnica, las integraciones permitidas y los límites arquitectónicos de este proyecto específico.

## Stack Tecnológico Principal
* **Frontend:** [Ej. React, Vite]
* **Backend:** [Ej. Node.js]
* **Bases de Datos:** [Ej. SQL Server, Supabase, PostgreSQL]
* **Infraestructura/Despliegue:** [Ej. Docker, Vercel, VPS local]

## Patrones Arquitectónicos
* Utilizar una arquitectura modular basada en componentes.
* Separar estrictamente la lógica de negocio (servicios/controladores) de la capa de interfaz de usuario.
* [Añadir cualquier otro patrón específico, ej. Arquitectura limpia, MVC, etc.]

## Límites de Integración y Entorno
* **Independencia Estricta:** Este aplicativo opera en su propio ecosistema. No tiene relación, dependencias compartidas ni debe intentar integrarse con sistemas heredados o paralelos (como TaskFlow Pro o el Portal de Operaciones de IT).
* **Herramientas de Agente (MCP):** El agente tiene permitido consumir servidores de Model Context Protocol configurados localmente para [Ej. leer esquemas de base de datos, interactuar con flujos de n8n].