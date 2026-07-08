package com.glenls.jml.constant.factory;

public enum PartsApprovalBtnEnum {
    BTN_SAVE("DTJ","保存草稿"),
    BTN_SUBMIT("SPZ","提交"),
    BTN_REJECT("YJJ","拒绝"),
    BTN_PASS("YTG","同意"),

    ;

    private String code;
    private String desc;


    PartsApprovalBtnEnum(String code, String desc) {
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
        for (PartsApprovalBtnEnum PartsApprovalBtnEnum : PartsApprovalBtnEnum.values()) {
            if (PartsApprovalBtnEnum.code.equals(code)) {
                return PartsApprovalBtnEnum.desc;
            }
        }
        return null;
    }
}
