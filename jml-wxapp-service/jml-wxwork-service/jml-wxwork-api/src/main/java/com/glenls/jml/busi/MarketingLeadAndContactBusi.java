package com.glenls.jml.busi;

import cn.hutool.core.util.StrUtil;
import com.glenls.commons.lang.kit.AppKit;
import com.glenls.jml.model.MarketingLeadAndContactModel;
import com.glenls.jml.modules.pub.kit.JmlKit;
import com.jfinal.aop.Inject;
import com.jfinal.plugin.activerecord.Db;
import org.apache.commons.lang3.ObjectUtils;
import org.apache.commons.lang3.StringUtils;

import java.util.*;


public class MarketingLeadAndContactBusi {
    @Inject
    private  MarketingLeadAndContactModel marketingLeadAndContactDao;


    public  void doSave(String marketingIdList, Map<String,Object> paramsMap,String leadId,String contactId) {
        if (ObjectUtils.isNotEmpty(leadId)) {
            paramsMap.put("leadId", leadId);
        }
        if (ObjectUtils.isNotEmpty(contactId)) {
            paramsMap.put("contactId", contactId);
        }
        if (StringUtils.isNotEmpty(marketingIdList)) {
            Set<String> marketIdSet = new HashSet<String>();
            List<String> marketIdList = StrUtil.split(marketingIdList, ",");
            List<MarketingLeadAndContactModel> listExistList = marketingLeadAndContactDao.queryListBy(paramsMap);
            if (listExistList.size() > 0) {
                for (MarketingLeadAndContactModel marketExistModel : listExistList) {
                    if (!marketIdSet.contains(marketExistModel.get("marketing_id"))) {
                        marketIdSet.add(marketExistModel.get("marketing_id"));
                    }
                }
            }
            List<String> needAddList = new ArrayList<String>();
            List<String> needUpdateList = new ArrayList<String>();
            if (marketIdSet.size() == 0) {
                needAddList.addAll(marketIdList);
            } else {
                for (String marketId : marketIdList) {
                    if (!marketIdSet.contains(marketId) && StringUtils.isNotEmpty(marketId)) {
                        needAddList.add(marketId);
                    } else {
                        marketIdSet.remove(marketId);
                    }
                }
            }
            if (needAddList.size() > 0) {
                List<MarketingLeadAndContactModel> addList = new ArrayList<>();
                for (String marketId : needAddList) {
                    MarketingLeadAndContactModel addModel = new MarketingLeadAndContactModel();
                    JmlKit.setSaveModel(addModel, paramsMap);
                    addModel.set("sales_lead_id", leadId);
                    addModel.set("contact_id", contactId);
                    addModel.set("marketing_id", marketId);
                    addList.add(addModel);
                }
                Db.batchSave(addList, AppKit.BATCH_SIZE);
            }
            if(marketIdSet.size() > 0) {
                marketIdSet.forEach((String marketId) ->{
                    needUpdateList.add(marketId);
                });
            }
            if(needUpdateList.size() > 0) {
                paramsMap.put("needUpdateList", needUpdateList);
                marketingLeadAndContactDao.updateMarketingLeadBy(paramsMap);
            }
        }else {
            
            marketingLeadAndContactDao.updateMarketingLeadBy(paramsMap);
        }
    }



}
