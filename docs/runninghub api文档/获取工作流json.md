# 获取工作流Json

## OpenAPI Specification

```yaml
openapi: 3.0.1
info:
  title: ''
  description: ''
  version: 1.0.0
paths:
  /api/openapi/getJsonApiFormat:
    post:
      summary: 获取工作流Json
      deprecated: false
      description: |+


      tags: []
      parameters:
        - name: Host
          in: header
          description: ''
          required: true
          example: www.runninghub.cn
          schema:
            type: string
      requestBody:
        content:
          application/json:
            schema:
              $ref: >-
                #/components/schemas/%E8%8E%B7%E5%8F%96%E5%B7%A5%E4%BD%9C%E6%B5%81Json%20Request
              description: ''
            example:
              apiKey: '{{apiKey}}'
              workflowId: '1904136902449209346'
      responses:
        '200':
          description: ''
          content:
            application/json:
              schema:
                $ref: >-
                  #/components/schemas/%E8%8E%B7%E5%8F%96%E5%B7%A5%E4%BD%9C%E6%B5%81Json%20Response
              example:
                code: 0
                msg: SUCCESS
                data:
                  prompt: >-
                    {"3":{"class_type":"KSampler","inputs":{"scheduler":"karras","negative":["7",0],"denoise":1,"latent_image":["5",0],"seed":669816362794144,"cfg":8,"sampler_name":"dpmpp_2m","model":["4",0],"positive":["6",0],"steps":20},"_meta":{"title":"KSampler"}},"4":{"class_type":"CheckpointLoaderSimple","inputs":{"ckpt_name":"MR
                    3DQ _SDXL V0.2.safetensors"},"_meta":{"title":"Load
                    Checkpoint"}},"37":{"class_type":"VAEDecode","inputs":{"vae":["4",2],"samples":["3",0]},"_meta":{"title":"VAE
                    Decode"}},"5":{"class_type":"EmptyLatentImage","inputs":{"batch_size":1,"width":512,"height":512},"_meta":{"title":"Empty
                    Latent
                    Image"}},"6":{"class_type":"CLIPTextEncode","inputs":{"speak_and_recognation":{"__value__":[false,true]},"text":"DreamWork
                    3D Style, a cute panda holding a bamboo in hands at sunset,
                    highly detailed, ultra-high resolutions, 32K UHD, best
                    quality, masterpiece,
                    ","clip":["4",1]},"_meta":{"title":"CLIP Text Encode
                    (Prompt)"}},"7":{"class_type":"CLIPTextEncode","inputs":{"speak_and_recognation":{"__value__":[false,true]},"text":"","clip":["4",1]},"_meta":{"title":"CLIP
                    Text Encode
                    (Prompt)"}},"9":{"class_type":"SaveImage","inputs":{"filename_prefix":"ComfyUI","images":["37",0]},"_meta":{"title":"Save
                    Image"}}}
          headers: {}
          x-apifox-name: 成功
      security: []
      x-apifox-folder: ''
      x-apifox-status: released
      x-run-in-apifox: https://app.apifox.com/web/project/6103976/apis/api-276613251-run
components:
  schemas:
    获取工作流Json Request:
      type: object
      properties:
        apiKey:
          type: string
          x-apifox-mock: '{{apiKey}}'
          description: ''
          examples:
            - '{{apiKey}}'
        workflowId:
          type: string
          x-apifox-mock: '1904136902449209346'
          examples:
            - '1904136902449209346'
      x-apifox-orders:
        - apiKey
        - workflowId
      required:
        - workflowId
        - apiKey
      x-apifox-ignore-properties: []
      x-apifox-folder: ''
    获取工作流Json Response:
      type: object
      properties:
        code:
          type: integer
          description: 返回标记：成功标记=0，非0失败，或者是功能码
          examples:
            - 0
        msg:
          type: string
          description: 返回信息
          examples:
            - success
        data:
          type: object
          properties:
            prompt:
              type: string
              examples:
                - >-
                  {\"3\":{\"class_type\":\"KSampler\",\"inputs\":{\"scheduler\":\"karras\",\"negative\":[\"7\",0],\"denoise\":1,\"latent_image\":[\"5\",0],\"seed\":669816362794144,\"cfg\":8,\"sampler_name\":\"dpmpp_2m\",\"model\":[\"4\",0],\"positive\":[\"6\",0],\"steps\":20},\"_meta\":{\"title\":\"KSampler\"}},\"4\":{\"class_type\":\"CheckpointLoaderSimple\",\"inputs\":{\"ckpt_name\":\"MR
                  3DQ _SDXL V0.2.safetensors\"},\"_meta\":{\"title\":\"Load
                  Checkpoint\"}},\"37\":{\"class_type\":\"VAEDecode\",\"inputs\":{\"vae\":[\"4\",2],\"samples\":[\"3\",0]},\"_meta\":{\"title\":\"VAE
                  Decode\"}},\"5\":{\"class_type\":\"EmptyLatentImage\",\"inputs\":{\"batch_size\":1,\"width\":512,\"height\":512},\"_meta\":{\"title\":\"Empty
                  Latent
                  Image\"}},\"6\":{\"class_type\":\"CLIPTextEncode\",\"inputs\":{\"speak_and_recognation\":{\"__value__\":[false,true]},\"text\":\"DreamWork
                  3D Style, a cute panda holding a bamboo in hands at sunset,
                  highly detailed, ultra-high resolutions, 32K UHD, best
                  quality, masterpiece,
                  \",\"clip\":[\"4\",1]},\"_meta\":{\"title\":\"CLIP Text Encode
                  (Prompt)\"}},\"7\":{\"class_type\":\"CLIPTextEncode\",\"inputs\":{\"speak_and_recognation\":{\"__value__\":[false,true]},\"text\":\"\",\"clip\":[\"4\",1]},\"_meta\":{\"title\":\"CLIP
                  Text Encode
                  (Prompt)\"}},\"9\":{\"class_type\":\"SaveImage\",\"inputs\":{\"filename_prefix\":\"ComfyUI\",\"images\":[\"37\",0]},\"_meta\":{\"title\":\"Save
                  Image\"}}}
          x-apifox-orders:
            - prompt
          description: 数据
          x-apifox-ignore-properties: []
      x-apifox-orders:
        - code
        - msg
        - data
      required:
        - code
        - msg
      x-apifox-ignore-properties: []
      x-apifox-folder: ''
  securitySchemes: {}
servers:
  - url: https://www.runninghub.cn
    description: runninghub.cn
security: []

```