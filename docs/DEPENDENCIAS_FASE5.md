# Fase 5: auditoría y mantenimiento de dependencias

Fecha: 5 de noviembre de 2026, America/Guayaquil.

**Actualización del 10 de noviembre:** se retiró el análisis gráfico antiguo por
decisión funcional. ECharts, ngx-echarts y echarts-wordcloud ya no están en el
manifiesto ni en el lockfile del frontend. La auditoría npm del frontend devuelve
**0 avisos, sin excepciones**. El detalle y el alcance conservado están en
[Retiro del análisis gráfico](RETIRO_ANALISIS_GRAFICO_20261110.md). Los resultados
del 5 de noviembre que siguen se conservan como registro histórico.

Entrega local en `subsanacion-dependencias-fase5`, desde `1eb8e26`.
No se publica, fusiona ni cambia la configuración de los servicios alojados.
La fase 5 sigue abierta: este documento registra el bloque de dependencias y
sus límites, no certifica ausencia de vulnerabilidades.

## Resultado de las auditorías

| Inventario bloqueado | Antes | Después |
|---|---|---|
| Composer, producción y desarrollo | 9 avisos en 6 componentes Symfony | 0 avisos; 0 paquetes abandonados. |
| npm del backend, herramientas Vite | 9 paquetes afectados: 1 crítico, 7 altos y 1 bajo | 0 avisos. |
| npm del frontend, incluyendo herramientas | 40 paquetes afectados: 5 altos y 35 moderados | 2 paquetes moderados asociados a un único aviso de ECharts; 0 altos/críticos. |

Los conteos de npm incluyen paquetes afectados por una dependencia transitiva,
por lo que no representan vulnerabilidades únicas. Los resultados corresponden
a los registros consultados en esta fecha; el control vuelve a consultarlos en CI.
Informes íntegros, logs y comparaciones: `storage/codex-local/phase5-dependencias/`,
ignorado por Git.

## Actualizaciones aplicadas

| Paquete o conjunto | Antes | Versión bloqueada |
|---|---|---|
| Angular framework y compiler-cli | 21.2.25 | 21.2.26 |
| Angular build, CLI y SSR | 21.2.27 | 21.2.29 |
| Vitest | 4.1.11 | 4.1.12 |
| body-parser, frontend | 2.3.0 | 2.4.0 |
| Symfony filesystem | 8.1.2 | 8.1.11 |
| Symfony http-foundation, http-kernel, routing y yaml | 7.4.21 | 7.4.23 |
| Symfony mime | 7.4.19 | 7.4.22 |
| Vite, herramientas del backend | 7.3.5 | 7.3.7 |
| Axios, herramientas del backend | 1.18.1 | 1.21.0 |

También se resolvieron parches transitivos dentro de los rangos de los manifiestos,
incluidos Undici, SDK MCP de la CLI, PostCSS y shell-quote. Se conservaron las
líneas mayores de Angular, Laravel, TypeScript, visores PDF y gráficos actuales.
No se ejecutó `audit fix --force`, no se omitieron peers ni requisitos de PHP.

El lockfile antiguo de Angular no resolvía coherentemente sus peers al cambiar
los parches. Se conservó una copia y se recalculó el lockfile desde el manifiesto
en una carpeta aislada con Node 24.17.0; después se verificó una instalación con
`npm ci`. El lockfile de Composer se actualizó selectivamente, sin instalar ni
ejecutar scripts sobre la aplicación local.

### Sustituciones de herramientas

`overrides` limita `glob@>=9.0.0 <=14.0.1` a 14.0.3 y
`minimatch@>=7.0.0 <11.0.1` a 11.0.1. Son cambios mayores transitivos
intencionados para herramientas de desarrollo; no afectan dependencias de
ejecución del navegador. Se probaron lint, reglas de calidad, CLI en dry-run,
suite Angular y compilación. La copia de minimatch que glob resuelve dentro de
su propio rango queda en 11.0.5, también fuera del rango afectado.

Revisar y retirar estas sustituciones cuando los paquetes padres incorporen
rangos corregidos. No generalizar esta técnica a otras bibliotecas sin verificar
sus consumidores y requisitos.

## Registro histórico: aviso ECharts del 5 de noviembre

Al preparar la entrega del 5 de noviembre permanecía
`GHSA-fgmj-fm8m-jvvx` / CVE-2026-45249 en ECharts 5.6.0.
Se propaga a `echarts-wordcloud` 2.1.0, por eso npm informa dos paquetes.
La corrección publicada es ECharts >=6.1.0, pero la extensión actual declara
peer `echarts: ^5.0.1`. No se afirma corregido el paquete vulnerable.

El aviso afecta a la serie **Lines** con tooltip y nombres no confiables; no es
la serie ordinaria **Line**. La aplicación usa un registro modular y no registra
Lines. Esta entrega incorpora:

- Una regla ESLint que impide bundles completos, imports dinámicos del bundle,
  imports globales de charts y el registro mediante import de `LinesChart`.
- Imports de tipos explícitos para `EChartsOption`, evitando importar el runtime
  completo al usar sus interfaces.
- Una prueba con el registro real: Line está disponible y Lines no lo está.

Estas medidas reducen la exposición por el recorrido descrito. No sustituyen la
migración ni cubren usos dinámicos que se introduzcan fuera de estos controles.
La migración debe resolver la compatibilidad de la nube de palabras, verificar
gráficos, tooltips y exportaciones y retirar la excepción.

La excepción tenía como límite el 5 de diciembre de 2026. Fue eliminada el
10 de noviembre junto con las dependencias afectadas; no se amplió su plazo.
Esto no equivale a la aceptación institucional de todas las fases.

## Controles y mantenimiento

`npm run audit:dependencies`, tanto en `frontend` como en `backend`, consulta el
lockfile completo, incluidas dependencias de desarrollo, opcionales y peers.
El ejecutor usa npm sin scripts de aplicación y falla ante una respuesta inválida,
error de red o aviso nuevo, incluso moderado o bajo.

Desde el 10 de noviembre no contempla excepciones: cualquier aviso, de cualquier
severidad, hace fallar el control. Se prueban explícitamente el rechazo del antiguo
aviso de ECharts y su propagación, además de los errores y respuestas
contradictorias del registro. ESLint impide reintroducir imports de las tres
librerías retiradas, incluidos imports de tipos, dinámicos y reexportaciones.

El workflow añade estas auditorías a frontend e higiene. Backend ejecuta
`composer audit --locked --no-interaction`, que debe quedar sin avisos. También
instala y compila las herramientas Vite del backend desde su lockfile. Los
controles se mantienen bajo el check obligatorio `Resultado`; no reciben
credenciales de despliegue ni ejecutan seeds o migraciones de producción.

Se prepara `.github/dependabot.yml` para revisiones semanales de ambos proyectos
npm y Composer, con destino `pruebas-rediseno`, grupos Angular/Symfony y revisión
separada de cambios mayores. No hay auto-merge. **No está activado por esta
entrega local**: GitHub lee la configuración desde su rama por defecto, que sigue
siendo `main`. Su incorporación allí deberá coordinarse por separado; no se
cambió esa rama ni la configuración externa del repositorio.

## Gestor de paquetes e instalación

Se retiró `install`, sin consumidores en código, y los dos lockfiles Bun.
Los scripts de PowerShell, Bash y batch usan npm, y las instalaciones reproducibles
usan `npm ci`. Ambos manifiestos declaran npm 11.13.0, que acompaña al Node
24.17.0 de CI y del build portable; `.nvmrc` documenta esa versión de Node.
No se instaló ni reemplazó globalmente Node/npm del equipo. Los lockfiles siguen
siendo v3 y la instalación local también se comprobó con npm 10.9.3/Node 22.19.0.

## Verificación local

| Control | Resultado |
|---|---|
| Auditorías npm y Composer | Resultados de la primera tabla y política temporal verificados. |
| Lint y reglas de calidad | Sin errores; 7 pruebas de calidad aprobadas. |
| Angular | 529 pruebas en 58 archivos, incluida la comprobación real de Lines. |
| Compilación frontend | Aprobada; avisos CSS de presupuesto conservados. |
| Cabeceras y PWA | 20 pruebas aprobadas sobre el build. |
| CLI Angular | Generación de componente en dry-run aprobada, sin escribir archivos. |
| PHPStan y plataforma PHP | Aprobados con PHP 8.4.27. |
| Regresión SQLite | 360 pruebas, 4.263 aserciones; 8 omisiones previstas para PostgreSQL. |
| Regresión PostgreSQL 16 | 173 pruebas, 2.325 aserciones en base desechable aislada. |
| Herramientas Vite del backend | Instalación y build con Node 24.17.0, sin .env. |
| Seguridad, workflows y política de auditoría | 53 pruebas aprobadas. |
| Scripts | Sintaxis PowerShell/Bash verificada; finales de línea Bash fijados a LF. |

Las pruebas de PHP no cargaron configuración privada ni datos del proyecto.
PostgreSQL de prueba no publicó puertos y su contenedor/red se retiraron al
terminar. Las imágenes de herramientas se conservan localmente. No se ejecutó
el nuevo workflow remoto ni se desplegó esta rama.

Referencias: [auditorías npm](https://docs.npmjs.com/cli/v10/commands/npm-audit/),
[auditorías Composer](https://getcomposer.org/doc/03-cli.md#audit),
[aviso ECharts](https://github.com/advisories/GHSA-fgmj-fm8m-jvvx),
[compatibilidad de wordcloud](https://github.com/ecomfe/echarts-wordcloud),
[parche Symfony MIME](https://symfony.com/cve-2026-45070),
[configuración Dependabot](https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference).
