import { describe, it, expect, beforeEach,test, vi } from "vitest";

import { z } from "zod";
import { createZodSchemaFromDeepRaw, ZodDeepRaw } from "../../../src/util/lib/zodMethodDefinedClass/deepRaw";

describe("createZodSchemaFromDeepRaw - 复杂场景测试", () => {
  it("应该能够处理深度嵌套的对象结构", () => {
    const deepNested: ZodDeepRaw = {
      level1: {
        level2: {
          level3: {
            level4: {
              level5: {
                level6: {
                  level7: {
                    level8: {
                      level9: {
                        level10: {
                          finalValue: z.string(),
                          anotherValue: z.number()
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    };
    
    const schema = createZodSchemaFromDeepRaw(deepNested);
    
    const validData = {
      level1: {
        level2: {
          level3: {
            level4: {
              level5: {
                level6: {
                  level7: {
                    level8: {
                      level9: {
                        level10: {
                          finalValue: "test",
                          anotherValue: 42
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    };
    
    const result = schema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it("应该能够处理复杂的混合结构", () => {
    const mixedComplex: ZodDeepRaw = {
      user: {
        profile: {
          personal: {
            name: z.string().min(2).max(50),
            age: z.number().int().min(0).max(150),
            birthDate: z.date(),
            isActive: z.boolean(),
            tags: z.array(z.string()),
            metadata: z.record(z.string(), z.any())
          },
          professional: {
            company: z.string().optional(),
            position: z.enum(["developer", "manager", "director"]),
            salary: z.number().positive().optional(),
            skills: z.array(z.object({
              name: z.string(),
              level: z.number().min(1).max(10),
              certified: z.boolean()
            }))
          }
        },
        settings: {
          privacy: {
            publicProfile: z.boolean(),
            showEmail: z.boolean(),
            dataSharing: z.object({
              marketing: z.boolean(),
              analytics: z.boolean(),
              thirdParty: z.boolean()
            })
          },
          notifications: {
            email: z.boolean(),
            push: z.boolean(),
            sms: z.boolean(),
            frequency: z.enum(["instant", "daily", "weekly"])
          }
        }
      }
    };
    
    const schema = createZodSchemaFromDeepRaw(mixedComplex);
    
    const validData = {
      user: {
        profile: {
          personal: {
            name: "John Doe",
            age: 30,
            birthDate: new Date(),
            isActive: true,
            tags: ["tag1", "tag2"],
            metadata: { key1: "value1", key2: 123 }
          },
          professional: {
            position: "developer" as const,
            skills: [
              { name: "JavaScript", level: 8, certified: true },
              { name: "TypeScript", level: 7, certified: false }
            ]
          }
        },
        settings: {
          privacy: {
            publicProfile: true,
            showEmail: false,
            dataSharing: {
              marketing: false,
              analytics: true,
              thirdParty: false
            }
          },
          notifications: {
            email: true,
            push: false,
            sms: true,
            frequency: "daily" as const
          }
        }
      }
    };
    
    const result = schema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it("应该能够处理数组和记录的复杂组合", () => {
    const arrayAndRecordComplex: ZodDeepRaw = {
      organizations: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          departments: z.record(
            z.string(),
            z.object({
              manager: z.object({
                employeeId: z.string(),
                name: z.string(),
                contact: z.object({
                  email: z.string().email(),
                  phone: z.string()
                })
              }),
              employees: z.array(
                z.object({
                  id: z.string(),
                  personal: z.object( {
                    name: z.string(),
                    address: z.object( {
                      street: z.string(),
                      city: z.string(),
                      country: z.string()
                    })
                  }),
                  employment:z.object(  {
                    position: z.string(),
                    salary: z.number(),
                    benefits: z.array(z.string())
                  })
                })
              )
            })
          )
        })
      )
    };
    
    const schema = createZodSchemaFromDeepRaw(arrayAndRecordComplex);
    
    const validData = {
      organizations: [
        {
          id: "org1",
          name: "Tech Corp",
          departments: {
            engineering: {
              manager: {
                employeeId: "mgr1",
                name: "Jane Smith",
                contact: {
                  email: "jane@example.com",
                  phone: "123-456-7890"
                }
              },
              employees: [
                {
                  id: "emp1",
                  personal: {
                    name: "John Doe",
                    address: {
                      street: "123 Main St",
                      city: "San Francisco",
                      country: "USA"
                    }
                  },
                  employment: {
                    position: "Developer",
                    salary: 80000,
                    benefits: ["health", "401k"]
                  }
                }
              ]
            }
          }
        }
      ]
    };
    
    const result = schema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it("应该能够处理条件验证结构", () => {
    const conditionalValidation: ZodDeepRaw = {
      account: {
        type: z.enum(["personal", "business", "enterprise"]),
        details: z.object({
          personal: z.object({
            firstName: z.string(),
            lastName: z.string(),
            ssn: z.string().optional()
          }).optional(),
          business: z.object({
            companyName: z.string(),
            taxId: z.string(),
            employees: z.number().int().positive()
          }).optional(),
          enterprise: z.object({
            legalName: z.string(),
            registrationNumber: z.string(),
            subsidiaries: z.array(z.string())
          }).optional()
        }),
        billing: {
          address: {
            line1: z.string(),
            line2: z.string().optional(),
            city: z.string(),
            country: z.string()
          },
          paymentMethods: z.array(
            z.object({
              type: z.enum(["credit", "debit", "bank"]),
              details: z.object({
                credit: z.object({
                  number: z.string(),
                  expiry: z.string(),
                  cvv: z.string()
                }).optional(),
                bank: z.object({
                  accountNumber: z.string(),
                  routingNumber: z.string()
                }).optional()
              })
            })
          )
        }
      }
    };
    
    const schema = createZodSchemaFromDeepRaw(conditionalValidation);
    
    const validData = {
      account: {
        type: "personal" as const,
        details: {
          personal: {
            firstName: "John",
            lastName: "Doe"
          }
        },
        billing: {
          address: {
            line1: "123 Main St",
            city: "San Francisco",
            country: "USA"
          },
          paymentMethods: [
            {
              type: "credit" as const,
              details: {
                credit: {
                  number: "4111111111111111",
                  expiry: "12/25",
                  cvv: "123"
                }
              }
            }
          ]
        }
      }
    };
    
    const result = schema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it("应该能够处理极其复杂的系统配置", () => {
    const ultimateComplex: ZodDeepRaw = {
      system: {
        version: z.string(),
        modules: z.record(
          z.string(),
          z.object({
            enabled: z.boolean(),
            config:z.object( {
              general: z.object( {
                timeout: z.number(),
                retries: z.number()
              }),
              specific: z.record(z.string(), z.any())
            }),
            dependencies: z.array(z.string()),
            metadata: z.object({
              author: z.string(),
              license: z.string(),
              repository: z.object({
                url: z.string().url(),
                branch: z.string()
              })
            })
          })
        ),
        security: {
          authentication: {
            methods: z.array(
              z.object({
                type: z.enum(["oauth", "jwt", "basic"]),
                config: z.object({
                  oauth: z.object({
                    clientId: z.string(),
                    clientSecret: z.string(),
                    endpoints: {
                      auth: z.string().url(),
                      token: z.string().url(),
                      userInfo: z.string().url()
                    }
                  }).optional(),
                  jwt: z.object({
                    secret: z.string(),
                    expiresIn: z.string(),
                    issuer: z.string()
                  }).optional()
                })
              })
            ),
            policies: z.array(
              z.object({
                name: z.string(),
                rules: z.array(
                  z.object({
                    condition: z.string(),
                    action: z.enum(["allow", "deny", "require_2fa"])
                  })
                )
              })
            )
          },
          logging: {
            level: z.enum(["debug", "info", "warn", "error"]),
            transports: z.array(
              z.object({
                type: z.string(),
                config: z.record(z.string(), z.any())
              })
            ),
            retention: {
              days: z.number(),
              compression: z.boolean()
            }
          }
        }
      }
    };
    
    const schema = createZodSchemaFromDeepRaw(ultimateComplex);
    
    const validData = {
      system: {
        version: "1.0.0",
        modules: {
          auth: {
            enabled: true,
            config: {
              general: {
                timeout: 5000,
                retries: 3
              },
              specific: {
                customSetting: "value"
              }
            },
            dependencies: ["database", "cache"],
            metadata: {
              author: "John Doe",
              license: "MIT",
              repository: {
                url: "https://github.com/example/auth",
                branch: "main"
              }
            }
          }
        },
        security: {
          authentication: {
            methods: [
              {
                type: "jwt" as const,
                config: {
                  jwt: {
                    secret: "secret-key",
                    expiresIn: "1h",
                    issuer: "example.com"
                  }
                }
              }
            ],
            policies: [
              {
                name: "admin-policy",
                rules: [
                  {
                    condition: 'user.role === "admin"',
                    action: "allow" as const
                  }
                ]
              }
            ]
          },
          logging: {
            level: "info" as const,
            transports: [
              {
                type: "console",
                config: {
                  colorize: true
                }
              }
            ],
            retention: {
              days: 30,
              compression: true
            }
          }
        }
      }
    };
    
    const result = schema.safeParse(validData);
    expect(result.success).toBe(true);
  });
});
