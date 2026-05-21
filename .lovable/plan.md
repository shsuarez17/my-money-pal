# Cambios a Acciones&ETF, Cripto, Dashboard y Metas

## ACCIONES & ETF + CRIPTO (componente compartido `AssetManager`)

1. **Barra de búsqueda**: input que filtra la tabla detallada por nombre/plataforma/tipo en vivo.
2. **Eliminar columna "Unidades"** del resumen y "Cantidad" del detalle.
3. **Conversión a moneda elegida**: junto a la columna USD agregar columna COP (u otra moneda seleccionable arriba de la tabla, default = moneda base del perfil). Aplica a resumen y detalle.
4. **Gráfico circular de % invertido**: dona con el porcentaje que cada activo representa sobre el subtotal **de esa página** (Acciones/ETF o Cripto), agrupado por nombre.
5. **Resumen**: añadir contador "N° de activos" (cantidad de filas únicas por nombre).
6. **Crear hoja personalizada** (alcance acotado): en Ajustes ya existen "tipos de activo personalizados". Lo dejo así — cada tipo personalizado funciona como una "hoja" filtrable. **Añado**:
   - Nueva ruta `/_authenticated/custom/$type` que renderiza el mismo `AssetManager` filtrando por ese tipo personalizado.
   - Botón en sidebar listando los tipos personalizados del usuario.
   - Botón "Duplicar tipo" en Ajustes que crea un nuevo tipo con sufijo "(copia)" — los activos no se duplican; solo el contenedor.
   - Cambiar nombre de un tipo personalizado (rename) actualiza los activos existentes para apuntar al nuevo nombre.

   > **Nota**: La idea original de "modificar las casillas y características de cada hoja" (columnas y campos por hoja) requiere un schema dinámico. Lo dejo fuera de este alcance — todas las hojas comparten las mismas columnas estándar. Si lo quieres, lo abordamos en una iteración aparte.

## DASHBOARD

1. **Eliminar columna "#"** (numeral) de la tabla "Activos".
2. **Distribución del portafolio**: agrupar por nombre (sin repetir), valor = suma de invertido en USD de ese nombre, porcentaje = invertido_nombre / total_invertido.
3. **Total USD**: cambiar de "valor actual" a "total invertido USD". Mostrar al lado el valor convertido (COP por defecto, o moneda base del perfil).
4. **Resumen — N° de activos**: tarjetas por categoría:
   - Acciones & ETF (cuenta de nombres únicos con tipo STOCK_US/STOCK_CO/ETF/BOND)
   - Cripto (cuenta de nombres únicos CRYPTO)
   - Personalizados (cuenta total de otros)
5. **Gráfico de evolución**: cambiar de `portfolio_snapshots` a una serie construida de las **fechas de compra** (`purchase_date`) de los activos. Eje X = fechas reales insertadas, valor = invertido acumulado en USD hasta esa fecha. Eliminar el efecto de snapshots para esta vista.

## METAS

1. Añadir tabla `goal_contributions` (user_id, goal_id, amount_usd, occurred_at) con RLS.
2. En cada tarjeta de meta:
   - Botón "+ Aportar" abre dialog para registrar un monto (cualquier moneda → convertido a USD).
   - Progreso = suma de contribuciones / target. **Puede superar 100%** — la barra se llena y el porcentaje sigue creciendo (ej. 137%).
   - Listar contribuciones recientes con opción de eliminar.

## Detalles técnicos

- Reusar `useUsdRates` para conversiones; selector de moneda persistido en estado local de cada página.
- Para "moneda base" preferida usar `useProfile().base_currency`.
- Migración SQL: crear `goal_contributions` con RLS por `user_id`.
- i18n: añadir claves `search`, `numAssets`, `addContribution`, `contribution`, `customSheets`, `duplicateType`, `renameType`.
