package com.glenls.jml.constant.factory;

import lombok.Getter;
import lombok.NoArgsConstructor;


@Getter
@NoArgsConstructor
public enum JobAssignStatusEnum {
    NEW("NEW","新建"),
    YFP("YFP","已分配"),
    YGWC("YGWC","员工完成"),
    ZGQR("ZGQR","主管确认");

    private String code;
    private String desc;


    JobAssignStatusEnum(String code, String desc) {
        this.code = code;
        this.desc = desc;
    }

    public String getCode() {
        return code;
    }

    public String getDesc() {
        return desc;
    }
    public static String getDescByCode(String code) {
        for (JobAssignStatusEnum JobAssignStatus : JobAssignStatusEnum.values()) {
            if (JobAssignStatus.code.equals(code)) {
                return JobAssignStatus.desc;
            }
        }
        return null;
    }
}
