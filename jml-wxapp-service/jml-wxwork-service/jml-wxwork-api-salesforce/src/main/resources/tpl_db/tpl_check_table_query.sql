select
    a.TABLE_NAME ,
    a.TABLE_TYPE
from
    information_schema.TABLES a
where
        table_schema = '#(dbName)'
  and table_name = '#(tbName)'