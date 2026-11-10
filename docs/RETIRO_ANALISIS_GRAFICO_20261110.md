# Retiro del análisis gráfico antiguo

Fecha: 10 de noviembre de 2026, America/Guayaquil.
Rama: `subsanacion-retiro-graficos`, desde `pruebas-rediseno` (`879acf6`).

## Decisión y alcance

La revisión encontró dos consumidores todavía accesibles: el inicio antiguo para
Usuario/Suscriptor y las rutas de análisis de variables de datasets, públicas y
protegidas. Las vistas rediseñadas de administración, supervisión, edición,
observatorios, publicaciones y Atlas usan los visores de PDF/Power BI y no
necesitan ECharts. Se autorizó retirar el análisis antiguo y conservar datos/API.

Se retiraron los gráficos del inicio antiguo, las pestañas de análisis de datasets,
las pantallas por variable, sus componentes de presentación, exportación de imagen,
registro modular y servicios de renderizado. La tabla pública se conserva en
`shared/components/data-table`; la configuración por lote de variables se conserva
en la pestaña existente «Configurar variables», sin enlaces a análisis retirados.

Los marcadores `/publico/datasets/:id/variable/:variableId` y
`/admin/datasets/:id/variable/:variableId` redirigen a la tabla del mismo dataset.
El destino protegido conserva sus controles de rol. No se añadieron permisos.

Se conservan las tablas y su paginación, los metadatos y fuentes de datasets,
las API y contratos estadísticos del backend, el almacenamiento SQL/MongoDB y los
visores PDF/Power BI. No se ejecutan migraciones ni eliminaciones de datos. El
retiro no modifica las publicaciones ni el diseño o los contratos de Barómetro.

## Dependencias y controles

Se eliminaron `echarts`, `echarts-wordcloud` y `ngx-echarts` del manifiesto y
lockfile, junto con sus dependencias exclusivas. El aviso anteriormente diferido
`GHSA-fgmj-fm8m-jvvx` deja de formar parte del inventario instalado.

`npm run audit:dependencies` no contiene excepciones ni plazos: cualquier hallazgo
hace fallar el control, también en backend. Las respuestas inválidas, errores de
registro o conteos contradictorios fallan de forma cerrada. ESLint bloquea la
reintroducción de las tres librerías mediante imports estáticos, dinámicos,
CommonJS, imports de tipos y reexportaciones.

La auditoría npm del frontend del 10 de noviembre devuelve 0 avisos de todas las
severidades, con desarrollo, peers y opcionales incluidos. El resultado depende
del inventario y del registro consultado; CI vuelve a comprobarlo en cada cambio.

## Validación y publicación

Las pruebas de regresión cubren la redirección de URLs antiguas, los roles
permitidos y el rechazo del rol Editor en el destino de datasets; la tabla pública
mantiene columnas visibles, fuentes y paginación. Se conservan las pruebas de
conteos y estado del inicio. Las pruebas del renderizador eliminado se retiran
junto con su implementación, sin omitir pruebas de funcionalidades conservadas.

Verificación local de esta entrega:

| Control | Resultado |
|---|---|
| npm, frontend y backend completos | 0 avisos y 0 excepciones en ambos proyectos. |
| Angular | 529 pruebas aprobadas en 59 archivos. |
| ESLint y reglas de calidad | Sin errores; 7 pruebas de las reglas aprobadas. |
| Auditoría, escáner, workflow, salud sintética y runtime portable | 45 pruebas aprobadas. |
| Build SPA y cabeceras/PWA | Compilación aprobada y 20 pruebas de cabeceras/PWA aprobadas; persisten los avisos de presupuesto CSS ya documentados. |

El número de pruebas Angular se mantiene en 529: se retiraron 7 pruebas del
renderizador eliminado y se añadieron 7 de navegación, permisos y tabla pública.
Los resultados remotos se consultan en el PR de la entrega.

La integración requiere `Resultado` verde con las auditorías, compilación,
cabeceras/PWA y recorridos de escritorio/móvil del workflow existente. Este
documento no cambia `main`, `deploy-gratis` ni la configuración del alojamiento.
La aceptación y el alojamiento institucional siguen pendientes por separado.
