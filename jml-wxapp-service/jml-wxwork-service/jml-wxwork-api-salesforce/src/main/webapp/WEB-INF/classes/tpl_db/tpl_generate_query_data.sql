###生成查询数据的SQL

###定义数据转换
#define convertData(detailConfModel)
    #if(detailConfModel.data_type == 'decimal' || detailConfModel.data_type == 'double') '0.00'
    #else if(detailConfModel.data_type == 'bigint' || detailConfModel.data_type == 'int') '0'
    #else if(detailConfModel.data_type == 'datetime' || detailConfModel.data_type == 'date') ''
    #else 'null'
    #end
#end

select
    #for(detailModel : pojo.detailList)
        #if("date" == detailModel.data_type && detailModel.format_str??)
                DATE_FORMAT(a.`#(detailModel.attr_code)` ,'#(detailModel.format_str)') as `#(detailModel.sf_attr_code)` #if(!for.last),#end
        #else if("datetime" == detailModel.data_type && detailModel.format_str??)
                DATE_FORMAT(date_add(a.`#(detailModel.attr_code)`,interval -8 hour) ,'#(detailModel.format_str)') as `#(detailModel.sf_attr_code)` #if(!for.last),#end
        #else if(detailModel.default_attr_code??)
                #if(!detailModel.fixed_val??) if(a.`#(detailModel.attr_code)` is null or a.`#(detailModel.attr_code)` = '',a.`#(detailModel.default_attr_code)`,a.`#(detailModel.attr_code)`) #else '#(detailModel.fixed_val)' #end as #(detailModel.sf_attr_code) #if(!for.last),#end
        #else
        #if(!detailModel.fixed_val??) a.`#(detailModel.attr_code)` #else '#(detailModel.fixed_val)' #end as #(detailModel.sf_attr_code) #if(!for.last),#end
        #end
    #end
from `#(pojo.model.code)` a
where
    1 = 1
    #if(tagetAttrKey??)
        and a.`#(tagetAttrKey)` = '#(tagetAttrVal)'
    #else if(idList?? && idList.size() > 0)
        and a.#(pojo.model.dbid_name) in (#for(idVal : idList) '#(idVal)' #if(!for.last),#end #end)
    #else
        and a.#(pojo.model.dbid_name) = '#(dbid)'
    #end
        and not exists (
            select
                count(1) as cnt
            from log_db_sf aa
            where
                aa.code = '#(pojo.model.code)'
                and aa.val = a.id
                and aa.createtime <= str_to_date(date_format(now(),'%Y-%m-%d 23:59:59'), '%Y-%m-%d %H:%i:%s')
		        and aa.createtime >= str_to_date(date_format(now(),'%Y-%m-%d 00:00:00'), '%Y-%m-%d %H:%i:%s')
            having count(1) > 3
        )

