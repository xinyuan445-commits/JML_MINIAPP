package com.glenls.api.modules.pub.busi;

import com.alibaba.fastjson.JSON;
import com.glenls.api.modules.pub.model.SysFuncModel;
import com.glenls.commons.lang.kit.AppKit;
import com.jfinal.aop.Inject;
import org.apache.commons.collections4.CollectionUtils;
import org.apache.commons.lang3.StringUtils;

import java.util.HashMap;
import java.util.List;
import java.util.Map;


public class SysFuncBusi{

	@Inject
	private SysFuncModel sysFuncDao;

	public boolean save(SysFuncModel model) {
		Long id = model.get("id");
		if(id == null){
			return model.save();
		}else{
			return model.update();
		}
	}

	public boolean saveMenuFunc(String updateDataListStr, String delDataListStr,Long loginUserId,String menuId) {
		if(StringUtils.isNotEmpty(updateDataListStr)){
			List<Map<String,Object>> updateDataList = JSON.parseObject(updateDataListStr, AppKit.TYPE_4_LIST_MAP);
			saveUpdate(updateDataList,loginUserId,menuId);
		}
		if(StringUtils.isNotEmpty(delDataListStr)){
			List<Long> deleDataList = JSON.parseArray(delDataListStr,Long.class);
			saveDel(deleDataList);
		}
		return true;
	}


	private void saveDel(List<Long> deleDataList){
		if(CollectionUtils.isEmpty(deleDataList)){
			return;
		}
		Map<String,Object> paramsMap = new HashMap<>();
		paramsMap.put("ids",deleDataList);

		sysFuncDao.delByIds(paramsMap);
	}


	private void saveUpdate(List<Map<String,Object>> updateDataList,Long loginUserId,String menuId){
		if(CollectionUtils.isEmpty(updateDataList)){
			return ;
		}

		for (Map<String,Object> mapParams: updateDataList) {
			Object id = mapParams.get("id");
			if(id == null || StringUtils.isEmpty((String)id)){
				mapParams.remove("id");
			}

			SysFuncModel model = sysFuncDao.findById(id);
			if(model == null){
				model = new SysFuncModel();
				model._setAttrs(mapParams);
				model.set("menuid",menuId);
				model.set("actionType",SysFuncModel.ACTION_TYPE__2);
				model.set("creator",loginUserId);
				model.save();
			}else{
				model._setAttrs(mapParams);
				model.update();
			}
		}
	}
}
