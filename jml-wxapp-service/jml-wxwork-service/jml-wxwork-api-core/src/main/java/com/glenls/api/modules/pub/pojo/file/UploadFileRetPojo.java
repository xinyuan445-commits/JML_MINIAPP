package com.glenls.api.modules.pub.pojo.file;

import java.io.Serializable;

import lombok.Data;
import lombok.extern.slf4j.Slf4j;


@Slf4j
@Data
public class UploadFileRetPojo implements Serializable {

	private static final long serialVersionUID = 1L;


	private String fileName;


	private String contentType;


	private String path;


	private String md5;



	private String url;


	private String fileExt;
}
