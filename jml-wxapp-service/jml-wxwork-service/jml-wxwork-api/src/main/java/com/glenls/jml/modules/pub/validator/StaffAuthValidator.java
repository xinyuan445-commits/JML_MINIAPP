package com.glenls.jml.modules.pub.validator;

import com.glenls.jml.modules.privilege.kit.RoleKit;
import com.glenls.jml.modules.privilege.pojo.StaffPojo;
import com.glenls.jml.modules.pub.kit.JmlKit;
import com.jfinal.core.Controller;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;


@Slf4j
public class StaffAuthValidator extends JmlBaseValidator {
    @Override
    protected void validate(Controller c) {
        super.validate(c);
        String staffId = getStaffId();
        log.info("staffId数据：" + staffId);
        if(StringUtils.isEmpty(staffId)){
            this.addError(ERROR_KEY,"未找到对应的员工Id信息，请联系管理员","-4");
            return;
        }

        StaffPojo staffPojo = RoleKit.initStaffInfo(staffId);
        log.info("staffPojo数据：" + staffPojo);
        if(staffPojo == null){

            log.info("-3切换了环境，无法获取到用户信息，重新获取下数据" + staffId);
            this.addError(ERROR_KEY,"","-3");
            return;
        }
        if(JmlKit.FLAG_0.equals(staffPojo.getStatus())){

            this.addError(ERROR_KEY,"该员工未启用，将要退出小程序","-4");
            log.info("该员工未启用，将要退出小程序" + staffId);
            return;
        }

        if(JmlKit.FLAG_1.equals(staffPojo.getIsReset())){

            log.info("员工重置了，重新登录获取数据" + staffId);
            this.addError(ERROR_KEY,"","-3");
            return;
        }
    }

    @Override
    protected void handleError(Controller c) {
        super.handleError(c);
    }
}
