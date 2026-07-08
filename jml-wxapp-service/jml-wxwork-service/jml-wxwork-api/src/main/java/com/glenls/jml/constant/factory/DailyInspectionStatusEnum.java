package com.glenls.jml.constant.factory;

public enum DailyInspectionStatusEnum {
    STATUS_DTJ("DTJ","待提交"),
    STATUS_DQR("DQR","待确认"),
    STATUS_YQR("YQR","已确认"),

    ;

    private String code;
    private String desc;


    DailyInspectionStatusEnum(String code, String desc) {
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
        for (DailyInspectionStatusEnum DailyInspectionStatusEnum : DailyInspectionStatusEnum.values()) {
            if (DailyInspectionStatusEnum.code.equals(code)) {
                return DailyInspectionStatusEnum.desc;
            }
        }
        return null;
    }
}
