package com.glenls.api.modules.pub.controller;

import cn.hutool.core.util.StrUtil;
import com.glenls.api.modules.pub.busi.DictBusi;
import com.glenls.commons.jboot.controller.BaseController;
import com.glenls.commons.lang.pojo.RestApiResult;
import com.jfinal.aop.Inject;
import io.jboot.web.controller.annotation.RequestMapping;
import org.apache.commons.lang3.StringUtils;

import java.util.List;


@RequestMapping("/api/core/dict")
public class DictController extends BaseController {

    @Inject
    private DictBusi dictBusi;



    public void all(){
        renderJson(dictBusi.queryAll());
    }


    public void queryItem(String tcode){
        if(StringUtils.isEmpty(tcode)){
            renderJson(RestApiResult.newFail("请传入查询参数"));
            return;
        }
        renderJson(dictBusi.queryByTCode(tcode));
    }

    public void queryDictBatch(){
        List<String> listTcode = StrUtil.split(getPara("tcode"), ",");
        renderJson(dictBusi.queryDictBatch(listTcode));
    }

    public void  dictTree(){
        renderJson(dictBusi.dictTree(getPara("tcode")));
    }
}
