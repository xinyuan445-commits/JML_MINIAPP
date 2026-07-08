package com.glenls.jml.constant.factory;

public enum JobAssigmentBtnEnum {
    BTN_SAVE("save","保存","save"),
    BTN_COMPLETE("complete","完成","complete"),
    BTN_CONFIRM("confirm","确认","confirm"),
    ;

    private String code;
    private String desc;
    private String value;


    JobAssigmentBtnEnum(String code, String desc,String value) {
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

    public String getValue(){
        return value;
    }
    public static String getDescByCode(String code) {
        for (JobAssigmentBtnEnum JobAssigmentBtnEnum : JobAssigmentBtnEnum.values()) {
            if (JobAssigmentBtnEnum.code.equals(code)) {
                return JobAssigmentBtnEnum.desc;
            }
        }
        return null;
    }
}
