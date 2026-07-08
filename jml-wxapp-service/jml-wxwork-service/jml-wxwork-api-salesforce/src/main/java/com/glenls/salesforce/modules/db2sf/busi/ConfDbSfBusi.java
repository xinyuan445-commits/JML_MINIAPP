package com.glenls.salesforce.modules.db2sf.busi;

import cn.hutool.core.util.ArrayUtil;
import com.glenls.commons.lang.pojo.RestApiResult;
import com.glenls.salesforce.modules.pub.kit.SalesforceKit;
import com.glenls.salesforce.modules.db2sf.model.SfSyncConfAuthModel;
import com.glenls.salesforce.modules.db2sf.model.SfSyncConfDbSfDetailModel;
import com.glenls.salesforce.modules.db2sf.model.SfSyncConfDbSfModel;
import com.glenls.salesforce.modules.db2sf.pojo.Db2SFConfPojo;
import com.jfinal.aop.Inject;
import io.jboot.Jboot;
import io.jboot.support.redis.JbootRedis;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.collections.CollectionUtils;
import org.apache.commons.lang3.StringUtils;

import java.util.ArrayList;
import java.util.List;


@Slf4j
public class ConfDbSfBusi {

    
    public static final String SYNC_TYPE_1 = "1";

    
    public static final String SYNC_TYPE_2 = "2";

    
    public static final String SYNC_TYPE_3 = "3";

    
    public static final String SYNC_TYPE_4 = "4";

    @Inject
    private SfSyncConfAuthModel confSfAddrDao;

    @Inject
    private SfSyncConfDbSfModel confAwsSfDao;

    @Inject
    private SfSyncConfDbSfDetailModel confAwsSfDetailDao;

    public static final String key = "dbToSF:conf:sf-url";


    public RestApiResult queryHost(){
        JbootRedis jBootRedis = Jboot.getRedis();
        String host = jBootRedis.get(key);
        if(StringUtils.isNotEmpty(host)){
            return RestApiResult.newSuccessWithData(host);
        }

        SfSyncConfAuthModel addrModel = confSfAddrDao.queryConf();
        if(addrModel == null){
            return RestApiResult.newFail("地址配置为空");
        }

        String url = addrModel.getStr("url");
        if(StringUtils.isEmpty(url)){
            return RestApiResult.newFail("地址配置为空");
        }

        jBootRedis.setex(key, SalesforceKit.CACHE_TIMEOUT_SENCONDS,url);

        return RestApiResult.newSuccessWithData(url);
    }



    private RestApiResult queryConfByCode(String code){
        if(StringUtils.isEmpty(code)){
            return RestApiResult.newFail("查询参数为空");
        }
        SfSyncConfAuthModel addrModel = confSfAddrDao.queryConf();
        if(addrModel == null){
            return RestApiResult.newFail("地址配置为空");
        }
        Db2SFConfPojo pojo = new Db2SFConfPojo();
        String url = addrModel.getStr("url");
        if(StringUtils.isEmpty(url)){
            return RestApiResult.newFail("地址配置为空");
        }
        pojo.setUrl(url);

        SfSyncConfDbSfModel model = confAwsSfDao.query(code);
        if(model == null){
            return RestApiResult.newFail(code + "主配置不存在");
        }

        pojo.setModel(model);

        List<SfSyncConfDbSfDetailModel> detailList = confAwsSfDetailDao.query(code);
        if(CollectionUtils.isEmpty(detailList)){
            return RestApiResult.newFail(code + "明细配置为空");
        }
        pojo.setDetailList(detailList);

        List<SfSyncConfDbSfDetailModel> removeAttrModelList = confAwsSfDetailDao.queryNotOnBodyAttr(code);
        if(CollectionUtils.isNotEmpty(removeAttrModelList)){
            List<String> removeAttrList = new ArrayList<>();
            for (SfSyncConfDbSfDetailModel detailModel : removeAttrModelList){
                removeAttrList.add(detailModel.get("sf_attr_code"));
            }
            pojo.setRemoveAttr(ArrayUtil.toArray(removeAttrList,String.class));
        }

        List<SfSyncConfDbSfDetailModel> updateAttrList = confAwsSfDetailDao.queryNeedUpdateAttr(code);
        pojo.setUpdateList(updateAttrList);

        return RestApiResult.newSuccessWithData(pojo);
    }


    public RestApiResult queryConf(String code){
        if(StringUtils.isEmpty(code)){
            return RestApiResult.newFail("查询参数为空");
        }

        boolean useCache = SalesforceKit.useConfCache();
        if(!useCache){
            return queryConfByCode(code);
        }
        String key = "dbToSF:conf:obj:" + code;
        JbootRedis jBootRedis = Jboot.getRedis();
        RestApiResult restApiResult = jBootRedis.get(key);
        if(restApiResult != null){
            return restApiResult;
        }
        restApiResult = queryConfByCode(code);
        if(restApiResult.isFail()){
            return restApiResult;
        }
        jBootRedis.setex(key,SalesforceKit.CACHE_TIMEOUT_SENCONDS,restApiResult);
        return restApiResult;
    }


    public Db2SFConfPojo getConfPojo(String code){
        RestApiResult restApiResult = queryConf(code);
        if(restApiResult.isFail()){
            return null;
        }

        Db2SFConfPojo pojo = (Db2SFConfPojo) restApiResult.getData();
        return pojo;
    }


    public SfSyncConfDbSfModel getMainConfModel(String code){
        Db2SFConfPojo pojo = getConfPojo(code);
        if(pojo == null){
            return null;
        }

        return pojo.getModel();
    }


    public SfSyncConfDbSfModel getMainConfModel(Db2SFConfPojo pojo){
        if(pojo == null){
            return null;
        }

        return pojo.getModel();
    }


    public String getMainConfAttr(String code,String attrName){
        SfSyncConfDbSfModel confModel = getMainConfModel(code);
        if(confModel == null){
            return null;
        }

        return confModel.get(attrName);
    }


    public String getMainConfAttr(Db2SFConfPojo pojo, String attrName){
        SfSyncConfDbSfModel confModel = getMainConfModel(pojo);
        if(confModel == null){
            return null;
        }

        return confModel.get(attrName);
    }


    public String getDbPrimaryKey(String code){
        return getMainConfAttr(code,"dbid_name");
    }


    public String getDbPrimaryKey(Db2SFConfPojo pojo){
        return getMainConfAttr(pojo,"dbid_name");
    }


    public String getSfidName(String code){
        return getMainConfAttr(code,"sfid_name");
    }


    public String getSfidName(Db2SFConfPojo pojo){
        return getMainConfAttr(pojo,"sfid_name");
    }


    public String getIgnoreUpdateCol(String code){
        return getMainConfAttr(code,"ignore_update_col");
    }


    public boolean isImmediateSync(String code){
        String syncType = getMainConfAttr(code,"sync_type");

        return SYNC_TYPE_1.equals(syncType);
    }
}
