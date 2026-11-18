# GitHub Education：学校邮箱门槛（email gate）

## 这条消息是什么

```
We require applicants of Ohio University to use one of these school-issued email addresses to apply:

ohio.edu

Please add and verify your school-issued email address in your account settings -- or a contact
email if you do not have one. Once your email is verified, you can try applying again.
```

这不是"材料不合格"，而是**这条路根本没开**。GitHub 的验证方式是按学校自适应的，官方文档原话：

> GitHub's verification process is individually tailored. **When the system detects that recent applicants from your school successfully verified using their academic email, future applicants from the same school must also use an academic email.**

对一个已经被判为"邮箱可验证"的学校，表单**不给 `Upload proof` 入口**，上传成绩单 / 学生证 / 在学证明这一步不会出现。所以 `us-transcript-pdf.cjs` / `jp-enrollment-pdf.cjs` 生成的任何材料，对这类学校都没有投递口。

## 三条官方出口

| # | 情形 | 做法 | 对 Ohio 是否可用 |
| --- | --- | --- | --- |
| 1 | 你有 `@ohio.edu` 邮箱 | Settings → Emails → 添加并验证 → 重新申请 | ✅ 最近便 |
| 2 | 学校**不**发学术邮箱 | 提供官方证明（学校官网页面，或学校抬头的信）说明该政策，再重新申请 | ❌ Ohio 发邮箱，此路不成立 |
| 3 | 学校域名未被识别 | 联系 GitHub Education Support，附学校全名 + 官网 URL + 你要用的域名 | ❌ `ohio.edu` 是已识别域名 |

邮箱侧的两个硬约束（官方拒因表里都有）：

- 必须是**全小写**，**不能用** plus-addressing（`user+school@ohio.edu` 无效）；错了就 Settings → Emails 删掉重加。
- 该邮箱若已被**另一个 GitHub 账号**用过申请 Student Pack，不能复用；GitHub ToS 禁止一人多账号。

## 本文涉及的 7 所学校

| 学校 | 学术域名 | 状态 |
| --- | --- | --- |
| Ohio University | `ohio.edu` | **已确认强制邮箱**（上面那条消息） |
| Pennsylvania State University | `psu.edu` | 未实测；这类大型公立校极可能同样强制，不要假设能走文档 |
| Purdue University | `purdue.edu` | 未实测，同上 |
| University of Florida | `ufl.edu` | 未实测，同上 |
| University of Michigan | `umich.edu` | 未实测，同上 |
| University of Washington | `washington.edu` | 未实测，同上 |
| Marshall University | `marshall.edu` | 未实测，同上 |

判定方式只有一种：**打开申请表单，看它问你要邮箱还是要材料**。问邮箱 → 文档路关闭；出现 `Upload proof` → 才轮得到材料。

不要为了试出哪家不强制而反复换学校提交：表单里的学校要和材料里的学校一致，反复改身份信息本身就是官方拒因 `Unclear academic affiliation documents` 的触发点，也会进风控。

## 结论

对 Ohio University：

1. 生成材料这条路**没有意义**，因为表单不会问你要材料；
2. 唯一确定能过的路径是搞到一个真实可收信的 `@ohio.edu` 地址（在读 / 校友 / 教职），在 Settings → Emails 验证后重新申请；
3. 没有该邮箱时，换学校比造材料更实际，但必须换成**表单给 `Upload proof` 入口**的学校，且材料与该学校一致。
