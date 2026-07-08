package com.glenls.jml.constant.factory;

public enum DeviceRepairStatusEnum {
    DB("DB","待办"),
    JXZ("JXZ","进行中"),
    YWC("YWC","已完成"),
    YRK("YRK","已认可"),
    YQX("YQX","已取消"),
    ;

    private String code;
    private String desc;


    DeviceRepairStatusEnum(String code, String desc) {
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
        for (DeviceRepairStatusEnum DeviceRepairStatusEnum : DeviceRepairStatusEnum.values()) {
            if (DeviceRepairStatusEnum.code.equals(code)) {
                return DeviceRepairStatusEnum.desc;
            }
        }
        return null;
    }
}
