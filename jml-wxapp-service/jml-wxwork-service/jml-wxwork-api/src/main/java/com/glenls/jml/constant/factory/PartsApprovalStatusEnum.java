package com.glenls.jml.constant.factory;

public enum PartsApprovalStatusEnum {

    DTJ("DTJ","待提交"),
    SPZ("SPZ","审批中"),
    YJJ("YJJ","已拒绝"),
    YTG("YTG","已通过");

    private String code;
    private String desc;


    PartsApprovalStatusEnum(String code, String desc) {
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
        for (PartsApprovalStatusEnum PartsApprovalStatus : PartsApprovalStatusEnum.values()) {
            if (PartsApprovalStatus.code.equals(code)) {
                return PartsApprovalStatus.desc;
            }
        }
        return null;
    }
    public static PartsApprovalStatusEnum findByCode(String code) {
        for (PartsApprovalStatusEnum status : PartsApprovalStatusEnum.values()) {
            if (status.getCode().equalsIgnoreCase(code)) {
                return status;
            }
        }
        return null;
    }
}
