package com.glenls.jml.weixin.weixin.bean.fans;

import lombok.Getter;
import lombok.Setter;


@Setter
@Getter
public class UserBaseInfoPojo {
	private Long subscribe;
	private String openid;
	private String nickname;
	private String sex;
	private String language;
	private String city;
	private String province;
	private String country;
	private String headimgurl;
	private Long subscribe_time;
	private String remark;
	private Long groupid;
	private String unionid;
}
