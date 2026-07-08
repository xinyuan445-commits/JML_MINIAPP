package com.glenls.jml.constant.factory;

public enum JobAssignCompletionStatusEnum {
    YWC("YWC","已完成"),
    WWC("WWC","未完成"),
    YQR("YQR", "已确认");
    ;

    private String code;
    private String desc;


    JobAssignCompletionStatusEnum(String code, String desc) {
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
        for (JobAssignCompletionStatusEnum JobAssignCompletionStatus : JobAssignCompletionStatusEnum.values()) {
            if (JobAssignCompletionStatus.code.equals(code)) {
                return JobAssignCompletionStatus.desc;
            }
        }
        return null;
    }

}
