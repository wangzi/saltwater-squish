-- Remove any category values that are not in the current whitelist from
-- products.categories. Rows are never deleted and no other column is
-- touched; a product simply loses the invalid entries from its categories
-- array (order of the remaining entries is preserved). If every entry on a
-- product turns out to be invalid, it is left with an empty array ('{}'),
-- matching the column's existing default.
--
-- Valid categories: Slow rise, Vaseline, Coconut oil, Crunchy, Slushy
--
-- Depends on the `products` table from 001_create_products.sql.

begin;

with filtered as (
  select
    p.id,
    coalesce(
      array_agg(c.value order by c.ord)
        filter (where c.value = any (array['Slow rise', 'Vaseline', 'Coconut oil', 'Crunchy', 'Slushy'])),
      '{}'
    ) as valid_categories
  from products p
  cross join lateral unnest(p.categories) with ordinality as c(value, ord)
  group by p.id
)
update products
set categories = filtered.valid_categories
from filtered
where products.id = filtered.id
  and products.categories is distinct from filtered.valid_categories;

commit;
