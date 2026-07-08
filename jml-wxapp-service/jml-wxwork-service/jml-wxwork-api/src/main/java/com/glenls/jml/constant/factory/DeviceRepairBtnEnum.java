package com.glenls.jml.constant.factory;

public enum DeviceRepairBtnEnum {

    BTN_ASSIGN("assign","分配维修员","assign"),
    BTN_REPAIR("repair","添加维修进展","repair"),
    BTN_COMPLETE("complete","完成维修","complete"),
    BTN_CONFIRM("confirm","认可","confirm"),
    BTN_CANCEL("cancel","取消","cancel"),
    BTN_RE_ASSIGN("assign","重新分配","re_assign")
    ;

    private String code;
    private String desc;
    private String value;


    DeviceRepairBtnEnum(String code, String desc, String value) {
        this.code = code;
        this.desc = desc;
        this.value = value;
    }

    public String getCode() {
        return code;
    }

    public String getDesc() {
        return desc;
    }

    public String getValue() {
        return value;
    }
    public static String getDescByCode(String code) {
        for (DeviceRepairBtnEnum DeviceRepairBtnEnum : DeviceRepairBtnEnum.values()) {
            if (DeviceRepairBtnEnum.code.equals(code)) {
                return DeviceRepairBtnEnum.desc;
            }
        }
        return null;
    }
}
