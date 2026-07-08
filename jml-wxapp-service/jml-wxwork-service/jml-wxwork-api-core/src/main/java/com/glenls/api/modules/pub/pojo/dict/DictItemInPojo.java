package com.glenls.api.modules.pub.pojo.dict;

import lombok.Getter;
import lombok.Setter;

import javax.validation.constraints.NotEmpty;
import javax.validation.constraints.NotNull;
import java.io.Serializable;


@Setter
@Getter
public class DictItemInPojo implements Serializable {
	
	private Long id;

	
	@NotNull(message = "字典ID不允许为空")
	private Long tid;

	
	@NotEmpty(message = "字典名称不允许为空")
	private String dname;

	
	@NotEmpty(message = "字典编码不允许为空")
	private String dcode;

	
	@NotEmpty(message = "字典值不允许为空")
	private String dval;

	
	private Integer sort;

	
	private String remark;

}
