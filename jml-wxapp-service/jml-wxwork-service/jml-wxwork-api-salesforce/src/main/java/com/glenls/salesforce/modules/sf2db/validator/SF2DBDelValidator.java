package com.glenls.salesforce.modules.sf2db.validator;

import com.alibaba.fastjson.JSON;
import com.glenls.commons.jfinal.validator.ValidatorExtend;
import com.glenls.salesforce.modules.sf2db.bean.Sf2DbDelPojo;
import com.jfinal.core.Controller;
import lombok.extern.log4j.Log4j;
import org.apache.commons.lang3.StringUtils;


@Log4j
public class SF2DBDelValidator extends ValidatorExtend {

    @Override
    protected void validate(Controller c) {
        super.validate(c);
        String rawData = c.getRawData();
        if (StringUtils.isEmpty(rawData)) {
            this.addError(ERROR_KEY, "参数不允许为空");
            return;
        }

        Sf2DbDelPojo pojo = null;
        try {
            pojo = JSON.parseObject(rawData, Sf2DbDelPojo.class);
        }catch (Exception e){
            log.error(e.getMessage(),e);
        }
        c.setAttr("pojo",pojo);
    }

    @Override
    protected void handleError(Controller c) {
        super.handleError(c);
    }
}
