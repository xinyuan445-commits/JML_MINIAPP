package com.glenls.api.modules.pub.pojo.dict;

import lombok.Getter;
import lombok.Setter;

import javax.validation.Valid;
import javax.validation.constraints.NotNull;
import java.util.List;


@Setter
@Getter
public class DictInPojo {

	@Valid
	@NotNull(message = "字典项不允许为空")
	private List<DictItemInPojo> dictItemList;
}
