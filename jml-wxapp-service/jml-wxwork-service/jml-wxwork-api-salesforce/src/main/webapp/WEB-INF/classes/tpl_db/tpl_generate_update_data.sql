###生成查询数据的SQL
update #(pojo.model.code)
set
    #for(detailModel : updateList)
    #(detailModel.attr_code)='#(detailModel.sfAttrVal)' #if(!for.last),#end
    #end
where
    #(pojo.model.dbid_name) = '#(dbid)'