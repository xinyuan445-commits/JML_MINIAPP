package com.glenls.salesforce.modules.sf2db.validator;

import com.glenls.commons.jfinal.validator.ValidatorExtend;
import com.jfinal.core.Controller;
import org.apache.commons.lang3.StringUtils;


public class SF2DBSaveValidator extends ValidatorExtend {

    @Override
    protected void validate(Controller c) {
        super.validate(c);
        String rawData = c.getRawData();
        if (StringUtils.isEmpty(rawData)) {
            this.addError(ERROR_KEY, "参数不允许为空");
            return;
        }
    }

    @Override
    protected void handleError(Controller c) {
        super.handleError(c);
    }
}
