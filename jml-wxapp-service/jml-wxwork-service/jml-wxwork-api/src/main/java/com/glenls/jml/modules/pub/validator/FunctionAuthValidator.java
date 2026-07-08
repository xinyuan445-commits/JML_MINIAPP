package com.glenls.jml.modules.pub.validator;

import com.glenls.commons.lang.pojo.RestApiResult;
import com.glenls.jml.modules.privilege.busi.StaffBusi;
import com.jfinal.aop.Aop;
import com.jfinal.core.Controller;
import lombok.extern.slf4j.Slf4j;


@Slf4j
public class FunctionAuthValidator extends JmlBaseValidator {

    private StaffBusi staffBusi = Aop.get(StaffBusi.class);

    @Override
    protected void validate(Controller c) {
        super.validate(c);

        String actionUrl = getActionKey();
        String staffId = getStaffId();

        RestApiResult checkRet = staffBusi.checkActionAuth(actionUrl,staffId);
        if(checkRet.isFail()){
            this.addError(ERROR_KEY,"无操作权限");
        }


    }

    @Override
    protected void handleError(Controller c) {
        super.handleError(c);
    }
}
