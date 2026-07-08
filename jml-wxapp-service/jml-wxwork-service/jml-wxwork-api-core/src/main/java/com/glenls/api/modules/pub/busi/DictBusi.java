package com.glenls.api.modules.pub.busi;

import com.glenls.api.modules.pub.model.SysDictModel;
import com.glenls.api.modules.pub.model.SysDictTypeModel;
import com.glenls.commons.lang.pojo.RestApiResult;
import com.jfinal.aop.Inject;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.collections4.CollectionUtils;
import org.apache.commons.lang3.StringUtils;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;


@Slf4j
public class DictBusi {

	@Inject
	private SysDictTypeModel sysDictTypeDao;

	@Inject
	private SysDictModel sysDictDao;



	public RestApiResult queryAll(){
		return RestApiResult.newSuccessWithData(sysDictTypeDao.queryAll(null));
	}


	public RestApiResult queryByTCode(String tcode){
		return RestApiResult.newSuccessWithData(sysDictDao.queryDictByTCode(tcode));
	}


	public RestApiResult queryDictBatch(List<String> listTcode){
		Map<String,List<SysDictModel>> dictReturnMapList = new HashMap<>();
		for(String dictStr : listTcode){
			List<SysDictModel> dictList = sysDictDao.queryDictByTCode(dictStr);
			dictReturnMapList.put(dictStr,dictList);
		}
		return RestApiResult.newSuccessWithData(dictReturnMapList);
	}

	public RestApiResult dictTree(String tcode){
		List<SysDictModel> list = sysDictDao.queryParentTcode(tcode);
		queryChildList(list);
		return RestApiResult.newSuccessWithData(list);
	}


	public void queryChildList (List<SysDictModel>  modelList){
		if(CollectionUtils.isEmpty(modelList)){
			return;
		}
		for(SysDictModel model : modelList){
			Long pid = model.get("id");
			List<SysDictModel> subDictList = sysDictDao.querySubDictByPid(pid);
			if(org.apache.commons.collections.CollectionUtils.isNotEmpty(subDictList)){
				queryChildList(subDictList);
				model.put("children",subDictList);
			}
		}

	}
}
