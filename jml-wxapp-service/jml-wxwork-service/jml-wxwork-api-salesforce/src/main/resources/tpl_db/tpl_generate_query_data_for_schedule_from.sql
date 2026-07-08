###生成分页查询数据的SQL
from `#(pojo.model.code)` a
where
    1 = 1
    #if(pojo.model.latest_sync_time??)
        and (a.`#(pojo.model.sync_check_col)` >= '#(pojo.model.latest_sync_time)' or a.sfid is null)
    #end
    and a.sync_status in ('1','3')

order by a.`#(pojo.model.sync_check_col)` desc