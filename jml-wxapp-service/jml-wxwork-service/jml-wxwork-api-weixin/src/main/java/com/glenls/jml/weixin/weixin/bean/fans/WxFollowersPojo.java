package com.glenls.jml.weixin.weixin.bean.fans;

import com.glenls.jml.weixin.weixin.bean.OpenidObject;


public class WxFollowersPojo {

	private int total;

	private int count;

	private OpenidObject data;

	private String next_openid;

	public int getTotal() {
		return total;
	}

	public void setTotal(int total) {
		this.total = total;
	}

	public int getCount() {
		return count;
	}

	public void setCount(int count) {
		this.count = count;
	}

	public OpenidObject getData() {
		return data;
	}

	public void setData(OpenidObject data) {
		this.data = data;
	}

	public String getNext_openid() {
		return next_openid;
	}

	public void setNext_openid(String next_openid) {
		this.next_openid = next_openid;
	}

}
